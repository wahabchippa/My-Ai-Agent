# Free AI API providers — 6 lists ka jaiza (16 Aug 2026)

Ye 6 "awesome list" repos check kiye gaye, sirf ye dhoondte hue: **koi aisa
free provider jo Nexora me pehle se nahi hai, aur jo asal me chalta ho.**

## Repos

| Repo | Kya mila | Faisla |
|---|---|---|
| `velo4705/awesome-free-byok-models` | 41 providers, har ek ka quota + base URL + live-verified model table (15 Aug 2026) | ✅ **Isi se sab kuch mila** |
| `foss42/awesome-generative-ai-apis` | GenAI APIs + gateways ki list | ⚠ Zyada tar paid (Anthropic, Stability, Perplexity) |
| `raullenchai/awesome-generative-ai-apis` | — | ❌ `foss42` ka **bilkul identical fork** (md5 same) |
| `howardpen9/awesome-ai-api-proxy` | Relay stations, LLM gateways, price tables | ❌ Sab paid relays — "cheapest per 1M tokens", free nahi |
| `superiorlu/AITreasureBox` | 519KB auto-collected repos/tools/papers | ❌ Repo aggregator, API list nahi |
| `abordage/awesome-ai` | Coding agents, IDE extensions, SDKs | ❌ Tools, API providers nahi |

**Natija:** 6 me se sirf 1 repo kaam ka nikla. Baqi ya paid the, ya duplicate,
ya bilkul mukhtalif cheez (tools/papers).

## velo4705 ke 41 providers — chhanti

Pehle se Nexora me: Google Gemini, Groq, OpenRouter, Cerebras, Cloudflare,
Cohere, Mistral, SambaNova, HuggingFace, LLM7.

Baqi 31 me se sab **API key maangte hain** — yani user ko sign-up karna
parega. Sirf inhe probe kiya gaya jo bina key ke kuch de sakte the:

```
OpenCodeZen    200  ← ✅ KEYLESS, chal gaya
VoidAI         500  (server error)
NVIDIA-NIM     401  key chahiye
Poixe          400  key chahiye
HelyxAI        401  key chahiye
Navy           401  key chahiye
Zylo           401  key chahiye
LLM.Kiwi       401  key chahiye
FreeInference  401  key chahiye (+ manual review)
AnyAPI         401  key chahiye
```

## ✅ Shipped: OpenCode Zen

`https://opencode.ai/zen/v1/chat/completions` — **`Authorization` header ke
baghair HTTP 200**. OpenCode team ke coding-agents ke liye tuned models.

Baqi keyless providers (Pollinations, LLM7) ka cutoff 2023-2024 hai, isi liye
wo `isStale()` me aate hain aur rank 90+ par parey rehte hain. **Zen ka cutoff
2025 hai — ye stale nahi hai**, yani asal kaam ke qabil hai.

### Saat models, sab live test kiye

| Model | Short prompt | Long code-review | Faisla |
|---|---|---|---|
| `nemotron-3-ultra-free` | ✔ 3/3 (0.8–2.6s) | ✔ 2985ch @22s | ✅ **added** (rank 35) |
| `hy3-free` | ✔ 3/3 (2.2–2.9s) | ✔ 2860ch @26s | ✅ **added** (rank 38) |
| `laguna-s-2.1-free` | ~ 1/3 | ✔ 3743ch | ❌ aksar rate-limited |
| `mimo-v2.5-free` | ✘ 0/3 | ✔ 771ch | ❌ na-qabil-e-aitbaar |
| `big-pickle` | ✘ | ✘ | ❌ `FreeUsageLimitError` |
| `deepseek-v4-flash-free` | ✘ | ✘ | ❌ `FreeUsageLimitError` |
| `nemotron-3.5-lightning-free` | ✘ | ✔ 3488ch | ❌ "thinking" content me leak karta hai |

Sirf 2 add kiye. Baqi 5 ko registry me daalna sirf pipeline me waqt zaya
karna hota — har nakaam koshish budget khati hai.

### Do hadood (dono registry me likhi hain)

1. **Quota IP-par-mabni aur tight** — jald `FreeUsageLimitError` aa jata hai.
   Isi liye ye pehla intikhab nahi.
2. **Raftaar** — ye reasoning models hain. Chhote jawab 0.8–2.9s, magar poora
   code review 25–30s (pehle `reasoning_content` me sochte hain). Hamara
   per-agent timeout 20s hai, to lambe kaam par ye aksar cut ho jate hain.

Isi liye rank 35/38: Groq (4s me poora review) aur Gemini se peeche, magar
har us cheez se aage jo key maangti hai aur user ke paas nahi.

## Sath me mila hua fix: retry ki had waqt hai, ginti nahi

Zen add karte waqt pata chala ke wo kabhi try hi nahi ho raha. Wajah: har
agent ke sirf 3 candidates the. Live par teenon (Gemini, Gemini, OpenRouter)
aik saath 429 de kar **1 second** me khatam ho gaye — jab ke **20 second
budget bacha tha** aur Zen ke tandurust models registry me mojood the. Agent
khaali haath laut aya jabke chalne wala model maujood tha.

Ab candidates 5 hain aur loop **waqt** par rukta hai, ginti par nahi. 429
~100-300ms me wapas aata hai, to nakaam koshish ka kharcha na ke barabar hai.

Is fix ke baad pehli dafa **teenon agents aik run me kaamyab** huye (30s).

## Jo key ke sath aur behtar ho sakta hai

**❌ Cerebras — rehne dein.** User ne khud kai baar check kiya: free limit
khatam ho jati hai (5 RPM / 250 RPD kaghaz par, amal me bohot kam). Registry
me entry mojood hai aur key na hone par khud-ba-khud skip ho jati hai, magar
is par waqt lagane ka faida nahi.

Agar aap 2 minute me sign-up karna chahen (sab free, koi card nahi):

| Provider | Quota | Kyun |
|---|---|---|
| **NVIDIA NIM** | 40 RPM / uncapped TPD | 100+ models, OpenAI-compatible. Sab se bara free catalogue (phone verification chahiye) |
| **Poixe** | 10,000 RPD / 10M TPD | Sab se bara daily quota |
| **Void AI** | **100 RPM** / 125k credits | Sab se zyada RPM. Probe par 500 de raha tha — baad me dobara dekhein |
| **MegaNova** | 60 RPM / 550 RPD / 200k TPM | Achha RPM/RPD balance |

Abhi sara bojh Groq + Gemini par hai. Testing me aik hi run me **11 model
tries** lagin kyunki dono bar bar 429 de rahe the. OpenCode Zen ab fallback
ka kaam de deta hai (bina key ke), magar wo reasoning model hai — lambe kaam
par 25-30s leta hai. Asal hal ek aur tez provider hai.

## Zaroori sabak: keyless models chup-chaap bahar the

Zen add karne ke baad bhi wo kisi test me nahi chala. Wajah `pickModels()`
me thi:

```ts
pool.filter((e) => e.envKey && !usedIds.has(e.id))
```

Keyless entries ka `envKey` `""` hai — **falsy** — to ye filter unhe poori
tarah bahar kar deta tha. Sirf Zen nahi, Pollinations aur LLM7 bhi kabhi
fallback nahi bane. Bug chhupa raha kyunki key wale models aksar chal jate
the.

`available()` pehle hi ye guarantee deta hai ke entry ki key set hai YA wo
keyless hai — yahan dobara filter karne ki zaroorat hi nahi thi.

Fix ke baad verify kiya: **zero keys par bhi app chalti hai** (5 models
available, Zen ne 885ms me jawab diya), aur research task me Logos asal me
Zen par chala.

---

# Z.ai (Zhipu) — test kiya, **add NAHI kiya** (16 Aug 2026)

User ne key di. Key **valid hai** (models list aa gayi), magar natija kaam ka
nahi nikla.

## Kya mila

`https://api.z.ai/api/paas/v4` — 9 models list hote hain:
`glm-4.5, glm-4.5-air, glm-4.6, glm-4.7, glm-5, glm-5-turbo, glm-5.1,
glm-5.2, glm-5.3`

**Sab 9 par yehi error:**
```
[1113] Insufficient balance or no resource package. Please recharge.
```

Teen endpoints try kiye — `/api/paas/v4`, `/api/coding/paas/v4`, aur
Anthropic-style `/api/anthropic/v1/messages` — teenon par wohi 1113.

## Sirf ek model free chala: `glm-4.5-flash`

Ye list me nahi tha, naam se guess kar ke mila. Chalta hai, magar:

| Test | Natija |
|---|---|
| Reliability | ✅ **5/5 pass** |
| "OK" kehne ka waqt | ❌ **9.5 – 14.1 sekind** |
| Asal code review | ❌ **54.2 sekind** |
| Knowledge cutoff | ❌ **"Joe Biden is president"** → 2023 |
| Zaya hui reasoning | 4004ch soch vs 2233ch asal jawab |

## Faisla: add nahi kiya

Teen wajuhat, har ek akeli kaafi hai:

1. **54s > poora budget.** Hamara per-agent timeout 20s hai aur total budget
   52s (Vercel 60s limit ki wajah se). Ye model akela poora budget kha jata
   hai — pipeline me kabhi mukammal hi nahi hoga.

2. **Cutoff 2023** → `isStale()` true → score me +1000 → ye Pollinations aur
   LLM7 ke saath sab se aakhri darje me chala jata, jahan se shazo-nadir hi
   koi model uthta hai.

3. **Jo pehle se hai wo behtar hai.** OpenCode Zen keyless hai, cutoff 2025,
   aur 0.8–2.6s me jawab deta hai. Z.ai us se har pehlu me peeche hai —
   aur us ke liye Vercel me ek env var bhi rakhna parta.

Yani key add karne se Nexora **behtar nahi, sirf bhaari** hoti.

## Agar aap Z.ai use karna hi chahen

Paid plan lena parega (GLM-4.6 / GLM-5 coding plan). Us soorat me `glm-4.6`
ya `glm-5` fast bhi hain aur 2025 cutoff bhi rakhte hain — tab add karna
mustahsan hoga. Entry banane me 2 minute lagenge, endpoint aur auth confirm
ho chuke hain:

```
url:    https://api.z.ai/api/paas/v4/chat/completions
auth:   Authorization: Bearer <ZAI_API_KEY>
fmt:    openai
```

---

# Round 3: GitHub topic search (16 Aug 2026)

User ne 6 search queries dein: `topic:ai-api`, `topic:llm-api`,
`topic:openai-api`, `awesome ai api`, `llm gateway`, `ai model api`.

GitHub search API se chalayin. **Natija: koi naya usable provider nahi mila.**

## Search se kya aaya

Zyada tar nateeje teen qism ke the, teenon hamare kaam ke nahi:

| Qism | Misalein | Kyun bekaar |
|---|---|---|
| **Self-hosted gateways** | LiteLLM (56k⭐), one-api (36k⭐), new-api (45k⭐), Portkey (12k⭐) | Ye *routing* karte hain — khud koi free model nahi dete. Aap ki apni keys chahiye |
| **Client libraries / SDKs** | langchain4j, multi-llm-ts, bellman | Code libraries, provider nahi |
| **Apps / demos** | LibreChat, private-gpt, chatgpt-demo | Products, API list nahi |

Char asli "free API list" repos mile:
`mnfst/awesome-free-llm-apis` (6.6k⭐), `open-free-llm-api/awesome-freellm-apis`
(1.8k⭐), `pacocartones/free-llm-api-hub`, `for-the-zero/Free-LLM-Collection`.

## Sab se acha: `pacocartones/free-llm-api-hub`

Ye ab tak dekhi hui behtareen list hai — blog post nahi, **maintained dataset**
hai: `data/providers.json` (69 providers, JSON schema ke sath validate hota
hai, README us se generate hota hai). Har entry me `card_required`,
`phone_required`, `openai_base_url`, `env_key`, `last_verified` structured
fields hain. Version 2.9.0, generated 2026-08-14.

Filter lagaya — text modality + `ongoing` (trial nahi) + no card +
OpenAI-compatible + jo Nexora me pehle se nahi:

**45 text providers → 15 qualify → 6 naye:**
Arli AI · ModelScope · Ollama Cloud · SiliconFlow (📱phone) · Typhoon (SCB 10X)
· W&B Inference

## Sab probe kiye — 6/6 key maangte hain

```
ArliAI       401  Authorization header missing or invalid
ModelScope   401  valid ModelScope token required
OllamaCloud  401  Unauthorized
SiliconFlow  401  Token is invalid
Typhoon      403  Unauthorized
WandB        401  Missing bearer authentication
```

Baqi 3 lists se bhi jo naye base URLs nikle, wo bhi probe kiye:

```
g4f.space    402  "No cake credits" — proof-of-work maangta hai
chutes.ai    429  hard rate limit (2 dafa retry par bhi)
nscale       401 · nebius 401 · dxnt 401 · aionlabs 401 · glhf 522
```

## Faisla: kuch add nahi kiya

Har naya provider sign-up maangta hai. Nexora ka asal masla **naye providers
ki kami nahi** — masla ye hai ke Groq aur Gemini par sara bojh hai aur wo 429
dete hain. Wo sirf ek aur *working key* se hal hoga, aur list me se koi bhi
key mufta nahi milti.

**OpenCode Zen (round 2 se) ab bhi ek-lauta keyless provider hai jo asal me
kaam karta hai.** Us ki qadar is round ke baad aur barh gayi: 4 lists,
100+ providers chhane, aur us jaisa doosra koi nahi mila.

Agar aap sign-up karne par razi hon to `providers.json` me sab se behtar
option **W&B Inference** hai ($100/month free credit, Llama 3.3 70B +
DeepSeek V4 Flash) — us ke baad ModelScope (~2,000 calls/day).

---

# Round 4: gateways & proxies (16 Aug 2026)

User ne 14 repos dein (2 duplicate: `router-for-me/CLIProxyAPI` do baar).
Ye pichhle rounds se **alag qism** ki cheezen thin — awesome-lists nahi,
balke chalne wale **gateways aur proxies**. Isi liye alag se dekha.

**Natija: koi bhi Nexora ko naya free model nahi deta. Sab BYOK hain
(Bring Your Own Keys).**

## Taqseem

| Repo | ⭐ | Ye asal me kya hai | Nexora ke liye |
|---|---|---|---|
| `BerriAI/litellm` | 56k | Self-hosted AI gateway, 100+ providers | ❌ Routing layer — aap ki keys chahiye |
| `router-for-me/CLIProxyAPI` | 47k | **Paid CLI subscriptions** (Kimi Code, Claude Code, Codex, Antigravity) ko API me badalta hai | ❌ Subscription chahiye |
| `Helicone/helicone` | 6.1k | LLM **observability** (logging, tracing) | ❌ Model provider hi nahi |
| `VRSEN/agency-swarm` | 4.5k | Multi-agent framework (Python) | ❌ Framework — hamara apna orchestrator pehle se hai |
| `APIParkLab/APIPark` | 1.8k | Enterprise API/LLM gateway | ❌ BYOK |
| `cuihuan/awesome-ai-gateway` | 85 | 160+ gateways ki list | ❌ Gateways ki list, models ki nahi |
| `mlpal-ai/mlpal-gateway` | 17 | `docker compose up` gateway (Postgres+Redis) | ❌ `.env` me apni keys daalni hain |
| **`google/clasp`** | 5.8k | **Google Apps Script CLI** | ❌ AI se koi taalluq nahi — ghalti se list me aa gaya |

## "Free" ka daawa karne wale — teenon BYOK nikle

Ye teen sab se ummeed-afza the. Har ek ka README parha:

**`Shaivpidadi/FreeRideV3`** — "102M+ tokens served in 35 days. $0 spent",
"community free-tier keys". Ummeed thi ke shared keys deta hoga.
Line 20 ne faisla kar diya:

> "No accounts, no subscriptions, no FreeRide cloud. **Local-first, BYO keys**"

Us ki provider table me har row par "**Get a key**" column hai
(openrouter.ai/keys, console.groq.com/keys…). Hosted endpoint
`api.free-ride.xyz/v1` bhi probe kiya → **404 `not_found`**.
"Community keys" ka matlab sirf ye ke community ne *apni* keys lagayin.

**`Decentralised-AI/freellmapi`** — 12 providers ko aggregate karta hai.
Line 114: "add **your** provider keys on the Keys page". Keys AES-256-GCM se
encrypt hoti hain — yani aap ki keys, aap ka server.

**`zxcloli666/AI-Worker-Proxy`** — Cloudflare Worker. Setup ka Step 2 hai
"Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`", phir apni provider
keys. Rotation deta hai, keys nahi.

## Duplicate

`ismailkonvah/awesome-free-llm-apis` (4⭐) = `mnfst/awesome-free-llm-apis`
(6.6k⭐) ka **purana fork**. Us me koi naya endpoint nahi (grep khaali).
`mnfst` wali round 3 me pehle hi chhan chuki hai.

## Asal sabak

Char round, ~15 repos, 100+ providers, 20+ live probes ke baad tasveer saaf
hai:

**Gateway ≠ free models.** LiteLLM, APIPark, FreeRide, mlpal — ye sab wohi
kaam karte hain jo Nexora ka `modelRegistry` + `pickModels()` pehle se karta
hai: multi-provider fallback, key rotation, rate-limit par agla model. Farq
sirf ye ke wo **alag service** hain jise host karna parta; hamara ye kaam
`/api/agents` ke andar hi hota hai.

In me se koi bhi cheez apna lena Nexora me ek nirbharta (dependency) barha
deta, aur **ek bhi naya model na deta**.

Jo cheez Nexora ko chahiye wo aik aur *chalti hui key* hai — aur wo kisi
gateway se nahi, provider ke sign-up se aati hai.


---

# Round 5 — Puter / Agnes / Kiro / Free-GPT4 (16 Aug 2026)

User ne 6 naam diye. Har ek live probe kiya.

## ✅ Agnes AI — ISE LO (registry me add kar diya)

`https://apihub.agnes-ai.com/v1` — OpenAI-compatible.

| | |
|---|---|
| Cost | Apne Flash models **$0**, "no fixed end date" |
| Card | **Nahi chahiye** |
| Limit | **~20 RPM** |
| Context | 512K (2.5-flash) |
| Extras | Tool calling, vision, streaming, image + video models |
| Cutoff | 2026 — **hamare sab models se naya** |

Live probe: `GET /v1/models` bina key → `{"error":{"message":"未提供令牌"}}`
(= "token nahi diya"). Yani endpoint **zinda hai**, bas key chahiye.
Ye baqi 90% "free" providers se behtar signal hai jo 404/522 dete hain.

Registry entries add ho gayin (`agnes-2.5-flash` rank 40, `agnes-2.0-flash`
rank 44), `envKey: "AGNES_API_KEY"`. Key na ho to `available()` inhe khud
skip kar deta hai — is liye add karna bilkul be-zarar hai.

**Key mil gayi aur LIVE TEST ho gaya (16 Aug 2026):**

| Model | Waqt | Content | Faisla |
|---|---|---|---|
| `agnes-2.5-flash` | **1.6s** | saaf | ✅ **rank 12** |
| `agnes-2.0-flash` | 2.6s | saaf | ✅ rank 22 (fallback) |
| `agnes-2.5-pro` | **22.2s** | saaf | ❌ AGENT_MAX_MS (20s) se upar |
| `agnes-2.5-pro-alpha` | 3.1s | reasoning-heavy | ❌ chhoda |

- **Training cutoff: JULY 2026** — hamare har doosre model se naya
- **12/12** back-to-back requests OK (RPM ~20 tang nahi hui)
- **Leak test 2/2 clean** — CoT alag `reasoning_content` field me jata hai,
  `content` me nahi ghustaa. Yani `looksLikeThinking()` wala purana masla
  Agnes par pesh nahi aata.
- Roman Urdu bhi theek bolta hai (test kiya).

### ⚠ Ek asli trap jo test me pakra gaya

`max_tokens: 20` par teenon models ne **poora budget `reasoning_content`
me kharch kar diya aur `content` KHALI chhoR diya** (`finish_reason: length`).
Yani chhote max_tokens par ye models khamosh nakaam hote hain.
`aiCall.ts` khali jawab pehle se reject kar deta hai, magar Agnes ke liye
**max_tokens kabhi ~200 se neeche na rakhein**. Registry comment me likh diya.

⚠ Ehtiyat: Tech Times ne theek likha — Google Maps / Twitter / Reddit sab
free shuru hue the. Agnes ko *bonus* samjho, buniyaad nahi.

## ❌ Puter.js — hamare liye kaam ka nahi (aur ye ahem hai)

Marketing: "free, unlimited, 500+ models, no API key". Haqeeqat me ye
**User-Pays** hai — har END USER apne Puter account se khud paisa deta hai.
Developer ka bill $0 rehta hai, magar model free nahi — user ka credit khatam
hone par 402.

Do wajah se Nexora me nahi lag sakta:

1. **Browser-only.** `puter.ai.chat()` ko browser me `<script>` chahiye jo
   Puter ke sath OAuth kare. Hamara pipeline (`aiCall.ts`, `/api/agents`)
   **server par** chalta hai. Server se probe kiya:
   `POST https://api.puter.com/drivers/call` → `{"code":"token_missing"}`.
   Temp account banane ki koshish → `captcha verification failed`. Server-side
   raasta jaan boojh kar band hai.
2. **Har user ko Puter account banana parega** — sign-in, credits, top-up.
   Ye "free AI" nahi, aap ke users par bill shift karna hai.

`@npcoder/puter-api` bhi yehi masla hal nahi karta: wo ek **local daemon**
(`127.0.0.1:8741`) hai jo browser SDK ko wrap karta hai. Aap ke laptop par
chalega, Vercel serverless par nahi.

Khud plugin author (`Mihai-Codes/opencode-puter-auth`) ka README:
*"Puter's marketing says 'Free, Unlimited' but this is misleading."*

## ❌ Free-GPT4-WEB-API (`d0ckmg/free-gpt4-web-api`)

`g4f` (gpt4free) ka wrapper — Bing/DuckDuckGo ke web UI ko scrape karta hai.
Teen wajah se na:
- **Docker container 24/7 chahiye** — Vercel par Docker chalta hi nahi.
- Scraping hai; provider HTML badle to toot jata hai. Repo ka apna demo
  server abhi bhi `Not Found` de raha hai (probe kiya).
- Plain text return karta hai, streaming/tool-calling nahi.

## ❌ Kiro AI

`kiro.dev` → HTTP 403. Ye AWS ka **IDE** hai (Cursor jaisa), API provider
nahi. Nexora me plug karne ki koi cheez nahi.

## ❌ "Token-Free Gateway"

Ye koi mukhtalis product nahi — general term hai. Round 1-4 me 15+ aise
gateway dekh chuke hain, sab BYOK. Round 4 ka natija barqarar hai:
**gateway ≠ free model.**

## Round 5 ka khulasa

6 me se **1** kaam ka: Agnes AI (add ho gaya, key ka intezar).
Puter aur Free-GPT4 dono "free unlimited" ka daawa karte hain aur dono me
asli shart chhupi hui hai (user-pays / self-hosted scraping).
