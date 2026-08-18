# 🔒 Nexora — Security & Bug Audit Report

**Date:** 2026-08-18
**Scope:** Poora repo (`main` @ `059c7e0`) — code review + live testing (dev server par)
**Result:** TypeScript build ✅ passes, `next build` ✅ passes, lint: **13 errors + 12 warnings**

---

## ✅ FIX STATUS (2026-08-18 — saare fixes apply + live-verified)

| # | Issue | Status |
|---|-------|--------|
| C1 | RCE `/api/execute` | ✅ **FIXED** — auth gate + `node:vm` sandbox (`contextCodeGeneration: {strings:false, wasm:false}`) + timeout 3s. Live test: blocklist-bypass attempt → `"Code generation from strings disallowed"`. |
| C2 | SSRF `/api/chat`, `/api/media` | ✅ **FIXED** — `src/lib/safeUrl.ts` (private/loopback/metadata IPs + hostname resolve). Live test: `127.0.0.1` aur `169.254.169.254` blocked, legit URL passes. |
| C3 | Zero-auth API abuse | ✅ **FIXED** — `src/lib/guard.ts`: login gate + guest per-IP limit (25/10min) on chat, master, stream, think, agents, build, media; `/api/execute` sirf login/internal. CORS ab origin-aware (`*` hata diya). Live tested. |
| C4 | Billing self-upgrade | ✅ **FIXED** — paid plan change ab sirf admin (`requireAdmin`); free downgrade sab ke liye. |
| C5 | IDOR api-keys DELETE | ✅ **FIXED** — `userId` filter + NaN id check + rowCount verify. |
| C6 | Admin bypass (users route) | ✅ **FIXED** — ab `getUser()` + `requireAdmin()`; hardcoded emails remove. |
| H1 | OAuth state (serverless) | ✅ **FIXED** — HMAC-signed state (`OAUTH_STATE_SECRET`); in-memory sirf fallback. |
| H2 | GitHub unverified email takeover | ✅ **FIXED** — sirf verified emails accept. |
| H3 | OTP insecure | ✅ **FIXED** — `crypto.randomInt`, code sirf non-production me return, verify-otp par brute-force protection (5 fails/15min). |
| H4 | SSRF in webFetch | ✅ **FIXED** — `readUrl` hamesha strict `isSafeUrl`. |
| H5 | SVG XSS | ✅ **FIXED** — `sanitizeSvg()` (scripts, on* handlers, javascript: URLs, foreignObject/iframe strip) render se pehle. |
| M1 | Hardcoded apilayer key | ✅ **FIXED** — env `APILAYER_API_KEY`; bina key ke feature skip. |
| M2 | Hardcoded admin emails | ✅ **FIXED** — C6 ke sath remove. |
| M3 | Tokens console.log | ✅ **FIXED** — sirf dev me log. |
| M4/M5 | Lint errors (13) | ✅ **FIXED** — **0 errors** (9 warnings sirf `<img>` LCP suggestions). |
| M6 | think/agents rate limit | ✅ **FIXED** — C3 guard ke sath. |
| M7 | Rate limit IP-only | ✅ **FIXED** — email + IP dono count (`or` clause). |
| M8 | `Function()` calculator eval | ✅ **FIXED** — `src/lib/safeCalc.ts` recursive-descent parser (chat + brain dono). |
| M10 | revokeSession hamesha true | ✅ **FIXED** — rowCount check. |
| M12 | isModelAllowed substring | ✅ **FIXED** — exact/prefix-with-separator match. |

**Verification:** `tsc` clean · `next build` success · lint 0 errors · RCE/SSRF/CORS/auth-gate live exploit re-tests sab block. 
**Naye env vars:** `OAUTH_STATE_SECRET`, `INTERNAL_API_SECRET`, `APILAYER_API_KEY`, `NEXORA_ALLOW_PRIVATE_ENDPOINTS` (.env.example me documented).
**Note:** DB-required fixes (C4/C5/C6/H3-verify) code-review verified hain — sandbox me PostgreSQL nahi tha, live test DB ke baghair possible nahi.

---



## 🚨 CRITICAL (immediately fix — live abuse possible)

### C1. RCE — `/api/execute` sandbox escape (PROVEN)
**File:** `src/app/api/execute/route.ts`

"Sandbox" sirf regex se blocks karta hai (`require|import|process|fs|eval|Function|globalThis`...), aur `new Function()` global scope me chalta hai. Regex ko string-splitting se bypass kiya ja sakta hai.

**Live proof (maine khud chala kar dekha):**
```bash
POST /api/execute  {"code":"return ({}).constructor.constructor(\"return proc\" + \"ess.version\")();"}
→ {"result":"v20.20.2"}   # ← Node.js process version leak
```
Matlab: **koi bhi bina login ke** server par arbitrary Node.js code chala sakta hai — env secrets (`process.env`), filesystem, network. Poora Vercel function/DB uske haath me.

**Fix:**
- Web Worker / `isolated-vm` / vm2 jaisa real sandbox use karo (aur wo bhi sahi config me), ya
- Is endpoint ko public band karo — sirf authenticated users, ya poora feature hatao. Code execution server-side kabhi client code par bharosa nahi kar sakta.

---

### C2. SSRF — user-supplied endpoint server-side fetch (PROVEN)
**Files:** `src/app/api/chat/route.ts` (line ~1070: `runGemini(b.endpoint...)`, generic openai branch), `src/app/api/media/route.ts` (line ~90: `fetch(b.endpoint)`)

Body me `endpoint` field client se aata hai aur server usay fetch karta hai — koi validation nahi.

**Live proof:** `/api/chat` me `endpoint: "http://localhost:3000/api/health"` bheja → server ne internal request ki (response `API error (405)` = connection ho gaya, sirf method mismatch).

Production me is se:
- Cloud metadata endpoint (`169.254.169.254`) hit ho sakta hai → IAM credentials
- Internal services (admin panels, DB admin) scan ho sakti hain
- **`/api/media` me key exfil:** agar `MODELSLAB_API_KEY` set hai to attacker apna endpoint bhej de → server usay `{key: "modelslab..."}` body me bhej deta hai → **key chori**

**Fix:** Endpoint allowlist (sirf known hosts: generativelanguage.googleapis.com, modelslab.com, etc.), private-IP/loopback block (RFC1918, link-local, metadata IPs), scheme sirf https.

---

### C3. Zero-auth API abuse — server API keys burn karwana (PROVEN)
**Files:** `/api/chat`, `/api/chat/stream`, `/api/think`, `/api/agents`, `/api/execute` — **kisi me bhi auth check nahi** (sirf memory ke liye `getSessionUserId`).

**Live proof:** bina cookie/header ke `POST /api/chat` → server keys use karke jawab mila (`{"text":"2..."}`).

Impact: koi bhi script/website (`Access-Control-Allow-Origin: *` ki wajah se koi bhi page se) server ke **GEMINI/GROQ/CEREBRAS keys ki poora quota jala sakta hai**. Free tiers daily limits hain — ek attacker aapki poori month ki limit 5 minute me khatam kar sakta hai. Aur `*` CORS ke saath ye abuse website se bhi ho sakta hai.

**Fix:** Sab AI endpoints par `getUser()` gate lagao (login zaroori), rate limit per-user/IP, CORS ko origin allowlist par le aao.

---

### C4. Billing self-upgrade — bina payment ke premium (code review)
**File:** `src/app/api/billing/route.ts` (POST → `action: "change_plan"`)

Koi bhi logged-in user:
```json
POST /api/billing  {"action":"change_plan","planSlug":"premium"}
```
→ turant premium plan + **2000 credits** + paid invoice `status:"paid"`. Payment validation bilkul nahi (comment me khud likha hai "in production this would go through Stripe" — but code live hai).

**Fix:** Payment flow implement hone tak is action ko server-side band karo / sirf admin allow karo.

---

### C5. IDOR — kisi bhi user ki API key revoke (code review)
**File:** `src/app/api/api-keys/route.ts` (DELETE)

```ts
await db.update(apiKeys).set({ status: "revoked" })
  .where(eq(apiKeys.id, parseInt(id)));   // ← userId filter NAHI hai!
```
Sequential `id` hota hai — koi bhi user kisi bhi user ki key revoke kar sakta hai (id guess karke). Baqi saare queries me `eq(apiKeys.userId, user.id)` hai, sirf DELETE me chhoot gaya.

**Fix:** `and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id))` + `parseInt` NaN check.

---

### C6. Admin bypass — user directory leak (code review)
**File:** `src/app/api/admin/users/route.ts`

```ts
const email = url.searchParams.get("email");
if (!ADMIN_EMAILS.includes(email)) return 403;  // ← sirf query param!
```
Koi bhi (bina login, bina cookie) `GET /api/admin/users?email=wahab.chippa@joinfleek.com` kare → **sare users ki email/name list + chat counts** mil jati hain. Ye "authentication" nahi hai, sirf ek string compare hai. Saath hi admin emails source code me hardcoded hain (public repo me!).

**Fix:** Baqi admin routes ki tarah `getUser()` + `requireAdmin()` use karo (wo theek hain). Admin emails DB role se aani chahiye, source se nahi.

---

## ⚠️ HIGH

### H1. OAuth state in-memory — serverless par toota hua flow
**File:** `src/lib/oauth.ts`

`stateStore` ek module-level `Map` hai. Vercel serverless me har invocation alag instance ho sakta hai → `validateOAuthState()` kabhi-kabhi fail → **Google/GitHub login intermittently 500**. Comment me khud likha hai "serverless instance stays alive long enough" — ye galat hai, guarantee nahi.

**Fix:** State ko signed cookie me daalo (HMAC), ya DB/Redis me rakho.

### H2. GitHub OAuth → account takeover risk
**File:** `src/lib/oauth.ts` → `fetchGitHubProfile()`

```ts
const any = emails[0];
email = primary?.email || verified?.email || any?.email;  // ← unverified email bhi!
```
GitHub unverified email allow karta hai. Attacker apne GitHub me victim ka email add kare (unverified) → OAuth login → `any.email` victim ki nikalti hai → `findOrCreateOAuthUser` (auth.ts) us email par mojood **existing account se link** kar deta hai → **victim ka account hijack**.

**Fix:** Sirf `verified === true` emails use karo; agar koi verified email nahi to error.

### H3. OTP insecure
**Files:** `src/app/api/auth/request-otp/route.ts`, `verify-otp/route.ts`

1. `Math.random()` se OTP generate hota hai — crypto-secure nahi. (`randomInt` use karo)
2. **Dev mode me OTP API response me wapas bheja jata hai** (`return NextResponse.json({ sent: false, code })`) — agar email service configured na ho (production me bhi ho sakta hai), to "OTP verification" ka koi matlab nahi — attacker khud apna OTP response me parh leta hai.
3. `verify-otp` me brute-force protection nahi — `used` flag ke ilawa attempts count/lockout nahi. 6-digit OTP = 1M combos, koi limit nahi.

### H4. SSRF in agent tools (webFetch)
**File:** `src/lib/webFetch.ts` → `readUrl()`

Agent/chat me user ka koi bhi URL server-side fetch hota hai (`redirect: "follow"`) — internal IPs ka koi block nahi. `/api/chat/master` isay research path me use karta hai. Cloud metadata/private network hit ho sakta hai. (Impact chat route ke SSRF jaisa hi, bas ye tool-based hai.)

**Fix:** URL allowlist + private IP block + redirects ke baad bhi validate.

### H5. XSS via SVG `dangerouslySetInnerHTML`
**File:** `src/lib/markdown.tsx` (line ~121)

AI-generated SVG ko seedha `dangerouslySetInnerHTML` se render kiya jata hai. Agar model (ya prompt-injection ke zariye) `<script>` ya `onload` wala SVG emit kar de → **stored/reflected XSS**, har user ke browser me. AI output par kabhi bharosa nahi.

**Fix:** SVG ko sanitize karo (e.g. DOMPurify), scripts/event handlers strip karo, ya SVG ko `<img src="data:...">` me render karo (execution nahi hoti).

---

## 🟡 MEDIUM

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| M1 | **Hardcoded API key** | `src/app/api/chat/route.ts` (phone validation: `access_key=0f78a1bb2ff03d7fe938dfcee5224214`) | Public repo me committed key — log isay use karke quota khatam kar sakte hain. Env me daalo. |
| M2 | **Hardcoded admin emails** | `src/app/api/admin/users/route.ts` | Source me plaintext — repo clone karne wala har koi "admin email" jaanta hai. |
| M3 | **Reset/verify tokens console.log** | `src/lib/auth.ts` (resendVerificationEmail, requestPasswordReset) | `console.log("[AUTH] Password reset token for X: <token>")` — server logs me plaintext token. Logs accessible hon to account hijack. |
| M4 | **Lint: components render ke andar** | `src/components/ArtifactsPanel.tsx` (143-145) | Har render par naye components bante hain → state/remount bugs. |
| M5 | **Lint: 13 errors** | `npm run lint` | React hooks warnings, sync scripts, unescaped entities. CI me lint fail hota hai. |
| M6 | **No rate limit on /api/think, /api/agents** | — | Unauthenticated + no limit → API cost/DoS. |
| M7 | **`checkRateLimit` per-IP only** | `src/lib/auth.ts` | NAT ke peeche sab users ek IP → shared ban; aur attacker IP rotate karke bypass. Per-email bhi hona chahiye. |
| M8 | **`gatherContext` calculator `Function()` eval** | `src/app/api/chat/route.ts` | Regex-santized hai lekin eval pattern risky hai — `Function` call hatao, hand-rolled parser/`mathjs` use karo. |
| M9 | **Unused `withTimeout` + dead code** | `src/app/api/chat/route.ts` | `callKilo`, `callOVH` ab ensemble me use nahi hote (sirf runOne me) — maintain burden. |
| M10 | **`revokeSession` hamesha `true`** | `src/lib/auth.ts` | Delete ka result check nahi — UI me "session revoked" galat dikh sakta hai. |
| M11 | **No CSRF tokens** | Saare session-cookie endpoints | Cookie SameSite=Lax ho to risk kam hai, lekin cookie config verify karo (`httpOnly`, `SameSite`, `Secure`). |
| M12 | **`isModelAllowed` substring match** | `src/lib/accessControl.ts` | `modelId.includes(m)` — "gpt-oss-120b" vs "gpt-oss-120b:free" jaisi prefix collisions. |

---

## ✅ Jo cheezein theek hain (credit jahan haq hai)

- **Passwords:** bcrypt (12 rounds), strong policy, account lockout (5 attempts / 15 min), per-IP rate limit
- **Sessions:** tokens DB me SHA-256 hash me, expiry + remember-me 30 days, password reset par sab sessions invalidate
- **IDOR fixes already applied:** `/api/brain` DELETE me userId filter, memory recall per-user (comments me documented)
- **Sanitization:** `src/lib/sanitize.ts` — API keys/cards/CNIC/phone redaction fail-closed, bhejne se pehle har user message se PII hatana — kamaal ka pattern
- **Admin routes** (`manage-user`, `models`, `settings`, `dashboard`, `audit-logs`): proper `getUser()` + `requireAdmin()`
- **Usage limits** (`checkUsageLimit`) chat/master me enforce hote hain
- **TypeScript + production build:** dono clean pass

---

## 🔧 Priority Fix Order

1. **C1** `/api/execute` band karo ya real sandbox (RCE — sabse pehle)
2. **C2 + H4** SSRF: endpoint/URL validation (metadata IP block zaroori)
3. **C3** AI endpoints par auth + rate limit + CORS allowlist
4. **C4** Billing self-upgrade band karo
5. **C5, C6** IDOR + admin bypass (2-line fixes)
6. **H1–H3** OAuth state, GitHub verified-email, OTP crypto/rate-limit
7. **H5** SVG sanitization
8. Baqi MEDIUM items cleanup

> ⚠️ **Note:** In fixes ke liye main `auth/accessControl` patterns already code me mojood hain — most fixes 5–20 lines ki hain. Agar chaho to main ye fixes apply kar doon, ya alag-alag explain kar doon. 😊
