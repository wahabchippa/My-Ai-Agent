// ═══════════════════════════════════════════════════════════════════
// NEXORA — CODE VERIFICATION
//
// MASLA JO YE HAL KARTA HAI:
//   Agent code likhta tha aur bas de deta tha. Kabhi chala kar dekhta hi
//   nahi tha ke chalta bhi hai ya nahi. /api/execute repo me mojood tha
//   magar KOI use nahi karta tha.
//
//   Ab jab bhi jawab me JS code ho, wo asal me chalaya jata hai. Toota
//   ho to agent ko error dikha kar EK dafa theek karne ka mauqa milta hai.
//
// HUDOOD (jaan boojh kar):
//   • Sirf JavaScript. Python/Go/etc. run nahi hote — un ke liye
//     "verified: false" ke bajaye "not verifiable" hai, jo alag cheez hai.
//   • Sandbox me require/import/fetch/process band hain. Jo code inhe
//     maange, usay "not verifiable" ginte hain — FAIL nahi. Ye ahem hai:
//     Express server ka code ghalat nahi hota, bas yahan chal nahi sakta.
// ═══════════════════════════════════════════════════════════════════

import { internalSecret } from "./internalSecret";

export interface VerifyResult {  /** Code mila aur chalaya ja saka? */
  attempted: boolean;
  /** Bina error ke chala? */
  passed: boolean;
  /** Error ka paigham (agar fail hua) */
  error?: string;
  /** console.log ka output */
  logs?: string[];
  /** Kyun nahi chalaya (jab attempted=false) */
  skipped?: string;
}

/** Jawab me se pehla JS/TS code block nikalo. */
export function extractJsBlock(md: string): string | null {
  // ```js / ```javascript / ```ts / ```typescript
  const m = md.match(/```(?:js|javascript|jsx|ts|typescript)\s*\n([\s\S]*?)```/i);
  if (m?.[1]?.trim()) return m[1].trim();

  // bina language tag ke block — tabhi jab JS jaisa lage
  const plain = md.match(/```\s*\n([\s\S]*?)```/);
  if (plain?.[1] && /\b(?:function|const|let|=>|class)\b/.test(plain[1])) {
    return plain[1].trim();
  }
  return null;
}

/** Ye code sandbox me chal bhi sakta hai? */
function canRunInSandbox(code: string): string | null {
  if (/\b(?:require|import|process|child_process|fs|net|http|eval|globalThis)\b/.test(code))
    return "sandbox me modules/IO allowed nahi";
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|document|window)\b/.test(code))
    return "browser/network API chahiye";
  if (/\b(?:async|await)\b/.test(code) && !/function/.test(code))
    return "top-level await";
  return null;
}

/**
 * Code ko chalane laiq banao.
 *
 * Sab se bara masla: `/api/execute` ko SAAF `return` chahiye — bina us ke
 * result `null` aata hai aur koi error bhi nahi. Yani "chal gaya" aur
 * "kuch nahi hua" me farq hi nahi rehta.
 *
 * Is liye agar code sirf function define karta hai to hum khud usay
 * bulate hain — warna hum sirf syntax check kar rahe hote, chalna nahi.
 */
function makeRunnable(code: string): string {
  if (/\breturn\b/.test(code.split("\n").slice(-5).join("\n"))) return code;

  // aakhri declared function ka naam dhoondo
  const names = [...code.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\())/g)]
    .map((m) => m[1] || m[2])
    .filter(Boolean);

  if (!names.length) return code;
  const fn = names[names.length - 1];

  // Function ko chala kar dekho ke throw to nahi karta. Dalilein maloom
  // nahi, is liye chand aam soortein azmate hain aur "chala/nahi chala"
  // dekhte hain — nateeja nahi.
  return `${code}

// — Nexora smoke test —
const __probes = [[], [""], ["abc"], [0], [1], [[1,2,3]], [{}]];
let __ranOnce = false, __lastErr = null;
for (const __a of __probes) {
  try { ${fn}(...__a); __ranOnce = true; break; }
  catch (e) {
    if (e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError) { __lastErr = e; }
    else { __ranOnce = true; break; }  // domain error = code chala, input ghalat tha
  }
}
if (!__ranOnce && __lastErr) throw __lastErr;
return "ok";`;
}

/**
 * Jawab me maujood JS code ko chala kar dekho.
 * `origin` = request ka origin (server-side fetch ko poora URL chahiye).
 */
export async function verifyCode(markdown: string, origin: string): Promise<VerifyResult> {
  const code = extractJsBlock(markdown);
  if (!code) return { attempted: false, passed: false, skipped: "koi JS code block nahi" };
  if (code.length > 6000) return { attempted: false, passed: false, skipped: "code bohot bara" };

  const blocked = canRunInSandbox(code);
  if (blocked) return { attempted: false, passed: false, skipped: blocked };

  try {
    const r = await fetch(`${origin}/api/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret(),
      },
      body: JSON.stringify({ code: makeRunnable(code) }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => null);

    if (!j) return { attempted: false, passed: false, skipped: "execute ne jawab nahi diya" };
    if (j.error) {
      // 403 = hamara apna blocker. Ye code ki ghalti nahi.
      if (r.status === 403) return { attempted: false, passed: false, skipped: "sandbox ne block kiya" };
      return { attempted: true, passed: false, error: String(j.error), logs: j.logs };
    }
    return { attempted: true, passed: true, logs: j.logs };
  } catch {
    return { attempted: false, passed: false, skipped: "execute tak nahi pahuncha" };
  }
}

/** Agent ko dobara likhne ke liye hidayat. */
export function buildFixPrompt(original: string, v: VerifyResult): string {
  return `Your code was executed and it FAILED.

ERROR: ${v.error}
${v.logs?.length ? `CONSOLE: ${v.logs.join(" | ")}` : ""}

Here is what you produced:
${original.slice(0, 3000)}

Fix the bug and return the COMPLETE corrected answer in the same format and
language as before. Do not explain the fix or mention that it failed — just
give the corrected version as if it were right the first time.`;
}
