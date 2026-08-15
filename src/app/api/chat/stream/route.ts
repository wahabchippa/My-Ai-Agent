// /api/chat/stream — SMART streaming. Groq Llama 70B PRIMARY (not a dumb race).
// Only falls back to other models if Groq fails. Quality over speed.

import { AIRFORCE_KEY } from "@/lib/keys";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type Msg = { role: string; content: string };

async function streamOpenAI(
  url: string, model: string, system: string, messages: Msg[], key?: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!res.ok || !res.body) throw new Error(`${model} failed`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) controller.enqueue(new TextEncoder().encode(content));
              } catch {}
            }
          }
        }
      } catch {}
      controller.close();
    },
  });
}

async function agentResearch(query: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  const clean = query.replace(/[?.!]/g, "").trim().slice(0, 80);
  const term = clean.replace(/\s+/g, "_").slice(0, 50);
  const [bingR, wikiR] = await Promise.allSettled([
    fetch(`https://r.jina.ai/https://www.bing.com/search?q=${encodeURIComponent(clean)}`, {
      headers: { Accept: "text/plain" }, signal: ctrl.signal,
    }),
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, { signal: ctrl.signal }),
  ]);
  clearTimeout(timer);
  const results: string[] = [];
  if (bingR.status === "fulfilled") {
    const text = await bingR.value.text().catch(() => "");
    const clean2 = text.replace(/^[\s\S]*?(?:results|Markdown Content:)/i, "")
      .replace(/\[(?:Skip|Image|Privacy|Terms|Accessibility|Close)[^\]]*\]/gi, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/https?:\/\/r\.bing\.com\/[^\s)]+/g, "")
      .replace(/\n{3,}/g, "\n\n").trim();
    const useful = clean2.slice(200, 1800).replace(/\s+/g, " ").trim();
    if (useful && useful.length > 30) results.push(useful);
  }
  if (wikiR.status === "fulfilled") {
    const w = await wikiR.value.json().catch(() => null);
    if (w?.extract) results.push(`Wikipedia: ${w.extract.slice(0, 200)}`);
  }
  return results.join(" | ");
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.messages) return new Response("Missing messages", { status: 400 });

  const now = new Date();
  const year = now.getUTCFullYear();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const lastUser = [...b.messages].reverse().find((m: Msg) => m.role === "user")?.content || "";

  // ALWAYS web search for context
  const research = await agentResearch(lastUser);

  // STRONG system prompt — prevents repetition, forces understanding
  let system = `You are Nexora — a brilliant, witty, deeply knowledgeable AI assistant. Today is ${dateStr} (year ${year}).

PERSONALITY:
- You are warm, engaging, and genuinely helpful — like talking to the smartest friend they know.
- You REMEMBER the conversation. NEVER repeat yourself. NEVER ask a question the user just answered.
- You understand context deeply. If the user says "it" or "that", you know what they mean from the conversation.
- You give COMPLETE, THOUGHTFUL answers — not short generic responses.
- You use the user's language (Roman Urdu, Urdu, Hindi, English).

ANSWER STYLE:
- Be conversational and natural — not robotic.
- Use **bold** for key points, bullets for lists, \`code\` for code.
- For complex topics: explain step by step with examples.
- For code: write complete working examples.
- Show genuine intelligence — connect ideas, give insights, be original.
- NEVER say "I don't have access" or "As an AI" — just answer naturally.`;

  if (research) system += `\n\n[WEB SEARCH RESULTS — use for accuracy]: ${research}`;

  // Use client's system if provided, merge with ours
  if (b.system) system = b.system + "\n\n" + system;

  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  const groqKey = process.env.GROQ_API_KEY || "";
  const blKey = process.env.BAZAARLINK_API_KEY || "";

  // PRIMARY: Groq Llama 3.3 70B (smartest free model — 70B params)
  // Only fall back if Groq fails
  try {
    const stream = await withTimeout(
      streamOpenAI("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", system, b.messages, groqKey),
      8000
    );
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
  } catch {
    // Groq failed — try alternatives IN ORDER of intelligence
  }

  // FALLBACK 1: BazaarLink DeepSeek V4
  try {
    const stream = await withTimeout(
      streamOpenAI("https://api.bazaarlink.ai/v1/chat/completions", "deepseek/deepseek-v4-flash:free", system, b.messages, blKey),
      6000
    );
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
  } catch {}

  // FALLBACK 2: OpenAPIs Claude (if online)
  try {
    const stream = await withTimeout(
      streamOpenAI("https://api.openapis.online/openai/v1/chat/completions", "claude-sonnet-4-6", system, b.messages, "admin"),
      5000
    );
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
  } catch {}

  // FALLBACK 3: AirForce Mistral Large
  try {
    const stream = await withTimeout(
      streamOpenAI("https://api.airforce/v1/chat/completions", "mistral-large-latest", system, b.messages, AIRFORCE_KEY()),
      6000
    );
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
  } catch {}

  // LAST RESORT: OpenRouter / LLM7 (less smart but always available)
  const orKey = process.env.OPENROUTER_API_KEY;
  const lastResort: Promise<ReadableStream<Uint8Array>>[] = [
    withTimeout(streamOpenAI("https://text.pollinations.ai/openai", "openai-fast", system, b.messages), 5000),
    withTimeout(streamOpenAI("https://api.llm7.io/v1/chat/completions", "gemini-3.1-flash-lite", system, b.messages), 5000),
  ];
  if (orKey) lastResort.unshift(
    withTimeout(streamOpenAI("https://openrouter.ai/api/v1/chat/completions", "google/gemma-4-31b-it:free", system, b.messages, orKey), 6000)
  );

  try {
    const stream = await Promise.any(lastResort);
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } });
  } catch {
    return new Response("__STREAM_FAILED__", { status: 502, headers: corsHeaders });
  }
}
