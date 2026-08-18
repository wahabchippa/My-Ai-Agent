// /api/media — Next.js route handler (ported from the Vercel serverless proxy).
//
// Frontend POSTs { key, init_image, prompt, model_id, ... }. This calls
// ModelsLab server-side (no CORS), and if the job is still processing,
// polls the fetch_result URL a few times before returning the video URL.

import { NextResponse } from "next/server";
import { guardApi, corsHeaders as cors } from "@/lib/guard";
import { isSafeUrl } from "@/lib/safeUrl";

interface MediaBody {
  key: string;
  endpoint: string;
  init_image?: string;
  prompt?: string;
  model_id: string;
  height?: number;
  width?: number;
  num_frames?: number;
  output_type?: string;
}

function isCredits(status: number, msg: string): boolean {
  return status === 402 || /credit|quota|payment|insufficient|balance|limit|expired|no key/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll(fetchResult: string, key: string): Promise<string | null> {
  for (let i = 0; i < 18; i++) {
    await sleep(5000);
    try {
      const r = await fetch(fetchResult, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.status === "success" && Array.isArray(d.output) && d.output.length) {
        return d.output[0] as string;
      }
      if (d?.status === "failed" || d?.status === "error") {
        throw new Error(d?.message || "Generation failed.");
      }
    } catch {
      /* keep polling */
    }
  }
  return null;
}

const corsHeaders = (req?: Request): Record<string, string> => cors(req);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  // ── AUTH GATE (guest per-IP limit) ──
  const guard = await guardApi(req, { allowAnon: true });
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, code: "auth" },
      { status: guard.status, headers: corsHeaders(req) }
    );
  }

  const b = (await req.json().catch(() => null)) as MediaBody | null;
  // Client key ya Vercel env — ek dafa set
  const key = (b?.key || process.env.MODELSLAB_API_KEY || "").trim();
  if (!b || !key) {
    return NextResponse.json(
      { error: "ModelsLab key nahi.", code: "credits" },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  // ── SSRF GUARD ──
  // `endpoint` client se aata hai aur server use fetch karta hai (sath
  // me key bhi body me hoti hai). Pehle private/internal endpoints allowed
  // the — attacker apna endpoint bhej kar key chura sakta tha.
  const safe = await isSafeUrl(b.endpoint, {
    allowPrivate: process.env.NEXORA_ALLOW_PRIVATE_ENDPOINTS === "1",
  });
  if (!safe.ok) {
    return NextResponse.json(
      { error: `Endpoint not allowed: ${safe.reason}`, code: "fail" },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  const payload = {
    key,
    model_id: b.model_id || "svd",
    init_image: b.init_image,
    prompt: b.prompt || "",
    height: b.height || 512,
    width: b.width || 512,
    num_frames: b.num_frames || 16,
    output_type: b.output_type || "mp4",
    webhook: null,
    track_id: null,
  };

  try {
    const r = await fetch(b.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(d?.message || d?.error || `ModelsLab error (${r.status})`);
      return NextResponse.json(
        { error: msg, code: isCredits(r.status, msg) ? "credits" : "fail" },
        { status: 502, headers: corsHeaders(req) }
      );
    }
    // immediate success
    if (d?.status === "success" && Array.isArray(d.output) && d.output.length) {
      const url = d.output[0] as string;
      return NextResponse.json(
        { url, video: url, image: url, status: "success" },
        { headers: corsHeaders(req) }
      );
    }
    // queued — poll the fetch_result endpoint
    if (d?.fetch_result) {
      const url = await poll(d.fetch_result, key);
      if (url)
        return NextResponse.json(
          { url, video: url, image: url, status: "success" },
          { headers: corsHeaders(req) }
        );
      return NextResponse.json(
        {
          status: "processing",
          fetch: d.fetch_result,
          message: "Still generating. Try again in a moment, or poll the link.",
        },
        { headers: corsHeaders(req) }
      );
    }
    return NextResponse.json(
      { error: d?.message || "Unexpected ModelsLab response.", code: isCredits(200, String(d?.message || "")) ? "credits" : "fail" },
      { status: 502, headers: corsHeaders(req) }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json(
      { error: msg, code: isCredits(500, msg) ? "credits" : "fail" },
      { status: 500, headers: corsHeaders(req) }
    );
  }
}
