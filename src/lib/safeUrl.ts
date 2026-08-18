// ═══════════════════════════════════════════════════════════════════
// NEXORA — SSRF GUARD
//
// Server-side fetch hone se PEHLE har URL yahan se guzarta hai:
//   • sirf http(s)
//   • localhost / internal hostnames blocked
//   • private / link-local / metadata IPs blocked (169.254.169.254 etc.)
//   • hostname resolve kar ke bhi check hota hai (best-effort)
//
// ⚠ DNS rebinding ke khilaf ye 100% guarantee nahi de sakta (resolve
// aur fetch ke darmiyan DNS badal sakta hai) — magar aam SSRF attacks
// (metadata theft, internal scan) is se band ho jate hain.
//
// Self-hosters jo apna local Ollama/lokal endpoint use karte hain, wo
// `NEXORA_ALLOW_PRIVATE_ENDPOINTS=1` set kar sakte hain (sirf AI
// endpoint wale paths par — webFetch hamesha strict rehta hai).
// ═══════════════════════════════════════════════════════════════════

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = /(^|\.)(localhost|local|internal|intranet|home|lan)(\.|$)/i;

/** IPv4/IPv6 private, loopback, link-local, CGNAT, metadata, multicast. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 10) return true; // 10/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] >= 224) return true; // multicast + reserved
    return false;
  }
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === "::1" || low.startsWith("::ffff:") && isPrivateIp(low.slice(7))) return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true; // link-local
    if (low.startsWith("ff")) return true; // multicast
    return false;
  }
  return false;
}

export interface SafeUrlResult {
  ok: boolean;
  reason?: string;
}

/**
 * Kya ye URL server-side fetch ke liye mehfooz hai?
 *
 * @param allowPrivate  true = private IPs allowed (self-hosted AI
 *   endpoints ke liye; sirf tab jab env me explicitly enable kiya jaye).
 */
export async function isSafeUrl(
  raw: string,
  opts: { allowPrivate?: boolean } = {}
): Promise<SafeUrlResult> {
  const allowPrivate = opts.allowPrivate === true;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) URLs allowed" };
  }

  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.test(host)) {
    return { ok: false, reason: "Local/internal hostname blocked" };
  }

  if (u.port && u.port !== "80" && u.port !== "443") {
    return { ok: false, reason: "Non-standard port blocked" };
  }

  // IP literal directly
  if (isIP(host)) {
    if (isPrivateIp(host) && !allowPrivate) {
      return { ok: false, reason: `Private IP blocked (${host})` };
    }
    return { ok: true };
  }

  // Hostname — resolve karke check karo (best-effort, DNS rebinding risk
  // comment me noted hai). Sirf ek dafa resolve hota hai, latency kam.
  try {
    const addrs = await lookup(host, { all: true });
    for (const a of addrs) {
      if (isPrivateIp(a.address) && !allowPrivate) {
        return { ok: false, reason: `Resolves to private IP (${a.address})` };
      }
    }
  } catch {
    return { ok: false, reason: "Hostname does not resolve" };
  }

  return { ok: true };
}
