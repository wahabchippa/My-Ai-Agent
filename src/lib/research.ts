// ═══════════════════════════════════════════════════════════════════
// NEXORA — WEB RESEARCH (freshness ka asal source)
//
// PURANE CODE KA MASLA:
//   • Bing ko r.jina.ai ke through scrape karta tha — ye ab reliably
//     block/rate-limit hota hai, to research aksar KHALI aata tha.
//   • Wikipedia lookup query ko underscore me badal ke title guess karta
//     tha ("what_is_the_latest_iphone") — jo kabhi match nahi karta.
//   • Sirf 5s timeout, aur fail hone pe chup-chaap "" return.
//
// Nateeja: model ke paas koi fresh data nahi aata tha, to wo apni purani
// 2023-24 training se jawab de deta tha. YEH aapke masle ki jarh thi.
//
// AB: 3 asli search sources, parallel, har ek independent — ek fail ho
// to baaki chalte rahen. Plus grounded models (Gemini) ka apna search.
// ═══════════════════════════════════════════════════════════════════

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<null>((res) => setTimeout(() => res(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/** DuckDuckGo Instant Answer — koi key nahi, koi block nahi. */
async function ddg(q: string): Promise<string> {
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return "";
    const d = await r.json();
    const bits: string[] = [];
    if (d.AbstractText) bits.push(`${d.AbstractText} (${d.AbstractSource || "DDG"})`);
    if (d.Answer) bits.push(String(d.Answer));
    if (d.Definition) bits.push(String(d.Definition));
    for (const t of (d.RelatedTopics || []).slice(0, 4)) {
      if (t?.Text) bits.push(t.Text);
    }
    return bits.join("\n").slice(0, 1200);
  } catch {
    return "";
  }
}

/** DuckDuckGo HTML — asli search results (title + snippet). */
async function ddgHtml(q: string): Promise<string> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return "";
    const html = await r.text();
    const out: string[] = [];
    const re =
      /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 6) {
      const title = strip(m[1]);
      const snip = strip(m[2]);
      if (title && snip) out.push(`• ${title} — ${snip}`);
    }
    return out.join("\n").slice(0, 1600);
  } catch {
    return "";
  }
}

/** Wikipedia — ab PROPER search API se, title-guessing nahi. */
async function wiki(q: string): Promise<string> {
  try {
    const s = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q
      )}&srlimit=2&format=json&origin=*`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000) }
    );
    if (!s.ok) return "";
    const sd = await s.json();
    const hits = sd?.query?.search || [];
    if (!hits.length) return "";
    const out: string[] = [];
    for (const h of hits.slice(0, 2)) {
      const sum = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          h.title.replace(/ /g, "_")
        )}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null);
      if (sum?.ok) {
        const d = await sum.json().catch(() => null);
        if (d?.extract) out.push(`[Wikipedia: ${d.title}] ${d.extract.slice(0, 500)}`);
      }
    }
    return out.join("\n\n");
  } catch {
    return "";
  }
}

/**
 * Wikidata — STRUCTURED current-officeholder data.
 *
 * Ye add karne ki wajah: DuckDuckGo aur Wikipedia snippets "Prime Minister
 * of Pakistan" jaise sawal pe office ki TAREEKH bata dete hain magar mojooda
 * shakhs ka naam nahi. Live test me model ne is wajah se 2024 ka purana
 * naam de diya tha. Wikidata claims (P35 head of state, P6 head of govt)
 * hamesha current hote hain aur jinka "end time" ho unhe hum skip karte hain.
 */
async function wikidata(q: string): Promise<string> {
  try {
    // Sawal me se entity nikalo: "Pakistan ka current prime minister kaun hai"
    // → "Pakistan". Stop-words hata kar sabse ahem noun rakhte hain.
    const cleaned = q
      .replace(
        /\b(who|what|which|is|are|the|current|currently|now|of|in|ka|ki|ke|kaun|hai|hain|konsa|kya|present|today|list|prime|minister|president|ceo|leader|head)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
    const term = cleaned || q;
    if (term.length < 2) return "";

    const sr = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
        term
      )}&language=en&format=json&limit=1&origin=*`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
    );
    if (!sr.ok) return "";
    const sd = await sr.json();
    const id = sd?.search?.[0]?.id;
    if (!id) return "";

    const er = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!er.ok) return "";
    const ed = await er.json();
    const ent = ed?.entities?.[id];
    const claims = ent?.claims || {};
    const label = ent?.labels?.en?.value || term;

    const PROPS: Record<string, string> = {
      P35: "head of state",
      P6: "head of government",
      P488: "chairperson",
      P169: "CEO",
    };

    const lines: string[] = [];
    for (const [prop, human] of Object.entries(PROPS)) {
      for (const cl of claims[prop] || []) {
        if (cl.rank === "deprecated") continue;
        if (cl.qualifiers?.P582) continue; // end time = ab nahi rahe
        const qid = cl.mainsnak?.datavalue?.value?.id;
        if (!qid) continue;
        const lr = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
        if (!lr?.ok) continue;
        const ld = await lr.json().catch(() => null);
        const name = ld?.entities?.[qid]?.labels?.en?.value;
        if (name) lines.push(`${label} — current ${human}: ${name}`);
      }
    }
    return lines.length ? `WIKIDATA (structured, current):\n${lines.join("\n")}` : "";
  } catch {
    return "";
  }
}

function strip(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kya is sawal ko live data chahiye?
 * Purana regex sirf hardcoded "2026" dhoondta tha — jo agle saal khud
 * purana ho jata. Ab year dynamic hai.
 */
export function needsResearch(q: string): boolean {
  // URL diya ho to hamesha — chahe koi keyword na ho.
  // Purana code sirf keywords dekhta tha, is liye "ye repo check karo
  // <link>" par research CHALTA HI NAHI tha aur agent keh deta tha
  // "main web search nahi kar sakta".
  if (/https?:\/\/|\b(?:github|gitlab|npmjs|stackoverflow)\.com\//i.test(q)) return true;

  // Sawal jo apni zaat me live data maangte hain
  if (/\b(search|google|dhoond|dekho|check kar|browse|look up|find out|kya chal raha)\b/i.test(q))
    return true;

  const y = new Date().getUTCFullYear();
  const years = [y, y - 1, y + 1].join("|");
  return new RegExp(
    `\\b(latest|newest|current|currently|recent|recently|today|tonight|yesterday|this (week|month|year)|` +
      `news|update|updated|now|nowadays|trending|price|cost|stock|market|score|won|winner|champion|` +
      `release[ds]?|launch(ed)?|version|who is the|president|prime minister|ceo|weather|forecast|` +
      `bitcoin|crypto|exchange rate|population of|as of|${years})\\b`,
    "i"
  ).test(q);
}

/**
 * Research chalao. Teenon sources parallel — ek ka fail hona baaki ko
 * nahi rokta (purana code Promise.allSettled ke bawajood ek shared
 * AbortController use karta tha, to ek timeout SAB ko maar deta tha).
 */
export async function research(query: string): Promise<string> {
  const q = query.replace(/[?!]/g, "").trim().slice(0, 200);
  if (!q) return "";

  const [a, b, c, d] = await Promise.all([
    withTimeout(ddgHtml(q), 10000),
    withTimeout(ddg(q), 9000),
    withTimeout(wiki(q), 9000),
    withTimeout(wikidata(q), 12000),
  ]);

  const parts: string[] = [];
  // Wikidata sabse UPAR — ye structured aur hamesha current hota hai, to
  // model isay sabse pehle parhta hai.
  if (d) parts.push(d);
  if (a) parts.push(`SEARCH RESULTS:\n${a}`);
  if (b) parts.push(`QUICK FACTS:\n${b}`);
  if (c) parts.push(c);

  if (!parts.length) return "";

  const stamp = new Date().toISOString().slice(0, 10);
  return `(fetched ${stamp})\n\n${parts.join("\n\n")}`;
}
