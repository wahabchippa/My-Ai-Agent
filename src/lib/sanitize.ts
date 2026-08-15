// ═══════════════════════════════════════════════════════════════════
// NEXORA — PII / SECRET SANITIZATION
//
// Idea source: ashishpatel26/500-AI-Agents-Projects → 21-pii-sanitization-agent
// Wahan ye ek paid API (TrustBoost) ko call karta hai. Yahan wahi pattern
// local regex se — koi API, koi key, koi latency, koi cost.
//
// Kyun zaroori hai: Nexora har message KAI providers ko bhejta hai
// (Google, Groq, OpenRouter…). Agar user galti se apni API key ya
// credit card paste kar de, to wo teen-chaar company ke logs me chala
// jata hai. Free tiers me to prompts training ke liye bhi use hote hain.
//
// Ye "fail closed" hai: shak ho to redact kar do.
// ═══════════════════════════════════════════════════════════════════

export interface SanitizeResult {
  text: string;
  redacted: boolean;
  /** kis kism ka data hataya gaya */
  kinds: string[];
  count: number;
}

interface Rule {
  kind: string;
  re: RegExp;
  label: string;
}

// Order matters — zyada khaas patterns pehle, taake generic unhe na kha jaye.
const RULES: Rule[] = [
  // ── API keys / tokens (sabse ahem) ──
  { kind: "openai_key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "openrouter_key", re: /\bsk-or-v1-[A-Za-z0-9]{32,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "anthropic_key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "groq_key", re: /\bgsk_[A-Za-z0-9]{40,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "google_key", re: /\bAIza[A-Za-z0-9_-]{30,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "github_token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, label: "[REDACTED_TOKEN]" },
  { kind: "github_pat", re: /\bgithub_pat_[A-Za-z0-9_]{50,}/g, label: "[REDACTED_TOKEN]" },
  { kind: "aws_key", re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, label: "[REDACTED_AWS_KEY]" },
  { kind: "slack_token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, label: "[REDACTED_TOKEN]" },
  { kind: "stripe_key", re: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{20,}/g, label: "[REDACTED_API_KEY]" },
  { kind: "bearer", re: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*/gi, label: "Bearer [REDACTED]" },
  { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, label: "[REDACTED_JWT]" },
  { kind: "private_key", re: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g, label: "[REDACTED_PRIVATE_KEY]" },

  // ── connection strings (password andar hota hai) ──
  {
    kind: "db_url",
    re: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@]+@[^\s]+/gi,
    label: "[REDACTED_DB_URL]",
  },

  // ── financial ──
  // Visa/MC/Amex/Discover — spaces ya dashes ke saath bhi.
  {
    kind: "credit_card",
    re: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))(?:[ -]?[0-9]{4}){2,3}\b/g,
    label: "[REDACTED_CARD]",
  },
  { kind: "iban", re: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/g, label: "[REDACTED_IBAN]" },

  // ── national IDs ──
  { kind: "us_ssn", re: /\b(?!000|666|9\d\d)\d{3}-\d{2}-\d{4}\b/g, label: "[REDACTED_SSN]" },
  // Pakistan CNIC — 13 digits, aksar 12345-1234567-1 format me.
  { kind: "pk_cnic", re: /\b\d{5}-\d{7}-\d\b/g, label: "[REDACTED_CNIC]" },

  // ── contact ──
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: "[REDACTED_EMAIL]" },
  // Phone — international + Pakistan (03xx-xxxxxxx).
  { kind: "phone", re: /(?:\+\d{1,3}[ -]?)?(?:\(\d{2,4}\)[ -]?)?\d{3,4}[ -]?\d{3,4}[ -]?\d{3,4}\b/g, label: "[REDACTED_PHONE]" },
];

/**
 * Phone rule bohot aggressive hai — wo saal, IDs, aur code ke numbers bhi
 * kha sakta hai. Is liye usay sirf tab lagate hain jab aas paas phone ka
 * context ho, ya string bilkul phone jaisi dikhe.
 */
function looksLikePhone(match: string, full: string, index: number): boolean {
  const digits = match.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  // Pakistan mobile
  if (/^0?3\d{9}$/.test(digits)) return true;
  if (match.trim().startsWith("+")) return true;
  const around = full.slice(Math.max(0, index - 30), index + match.length + 15).toLowerCase();
  return /\b(phone|mobile|cell|call|tel|whatsapp|contact|number|rabta)\b/.test(around);
}

/**
 * Text se PII/secrets nikaal do.
 *
 * @param text  user ka raw message
 * @param opts.aggressive  true = email/phone bhi hatao (default),
 *                         false = sirf keys/cards/IDs (chat me email likhna
 *                         aksar jaiz hota hai, e.g. "regex for email")
 */
export function sanitize(
  text: string,
  opts: { aggressive?: boolean } = {}
): SanitizeResult {
  const { aggressive = true } = opts;
  if (!text) return { text, redacted: false, kinds: [], count: 0 };

  let out = text;
  const kinds = new Set<string>();
  let count = 0;

  for (const rule of RULES) {
    if (!aggressive && (rule.kind === "email" || rule.kind === "phone")) continue;

    if (rule.kind === "phone") {
      out = out.replace(rule.re, (m, ...args) => {
        const idx = args[args.length - 2] as number;
        const full = args[args.length - 1] as string;
        if (!looksLikePhone(m, full, idx)) return m;
        kinds.add(rule.kind);
        count++;
        return rule.label;
      });
      continue;
    }

    out = out.replace(rule.re, () => {
      kinds.add(rule.kind);
      count++;
      return rule.label;
    });
  }

  return { text: out, redacted: count > 0, kinds: [...kinds], count };
}

/** Chat messages ke array par sanitize chalao. */
export function sanitizeMessages<T extends { role: string; content: string }>(
  messages: T[],
  opts: { aggressive?: boolean } = {}
): { messages: T[]; redacted: boolean; kinds: string[] } {
  const allKinds = new Set<string>();
  let any = false;

  const out = messages.map((m) => {
    if (m.role !== "user" || !m.content) return m;
    const r = sanitize(m.content, opts);
    if (r.redacted) {
      any = true;
      r.kinds.forEach((k) => allKinds.add(k));
      return { ...m, content: r.text };
    }
    return m;
  });

  return { messages: out, redacted: any, kinds: [...allKinds] };
}

/** Logs/headers ke liye — secret kabhi log na ho. */
export function safeForLog(text: string, max = 200): string {
  return sanitize(text, { aggressive: true }).text.slice(0, max);
}
