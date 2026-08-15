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
