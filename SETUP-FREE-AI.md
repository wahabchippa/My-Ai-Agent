# Nexora — Free AI Setup (10 minute, 0 rupees)

> **Aapka masla:** AI 2023/2024 ke purane jawab de raha tha.
> **Asal wajah:** neeche "Kya kharab tha" section mein — aur wo ab fix ho chuka hai.
> **Aapko sirf itna karna hai:** neeche Step 1 se 3 follow karein.

---

## ⚡ TL;DR — 3 steps

```bash
# 1. Key lein (koi credit card nahi chahiye)
#    Gemini  → https://aistudio.google.com/apikey
#    Groq    → https://console.groq.com/keys

# 2. .env file mein daalein
echo 'GEMINI_API_KEY=your_key_here' >> .env
echo 'GROQ_API_KEY=your_key_here'   >> .env

# 3. Verify karein
node scripts/verify-models.mjs
npm run dev
# phir kholein: http://localhost:3000/api/health/models?deep=1
```

---

## 🔴 Kya kharab tha (asal diagnosis)

Maine 16 August 2026 ko har provider live test kiya. Ye mila:

### Masla #1 — Keyless endpoints jhoot bol rahe the

Code `api.llm7.io` aur `text.pollinations.ai` use kar raha tha kyunki wo bina key ke chalte hain. Maine unse poocha ke tum kaun ho:

| Code mein naam likha tha | Asal mein kya nikla | Cutoff |
|---|---|---|
| `gemini-3.1-flash-lite` | **GPT-4o** | Oct 2023 |
| `gpt-oss:20b` | **GPT-4** | Sep 2021 |
| `DeepSeek-V4-Flash-0731` | **GPT-4o** | Oct 2023 |
| `minimax-m2.7` | (bola: "current president = Joe Biden") | 2024 |
| `codestral-latest` | Mistral | Oct 2023 |

Ye endpoints **koi bhi model naam accept kar lete hain** aur chupke se kuch aur serve karte hain. Naam "gemini-3.1" likha hai, andar GPT-4o baitha hai.

### Masla #2 — Race hamesha purana model jeetta tha

`chat/route.ts` mein sab models ek saath `Promise.any` mein jate the — **jo pehle bole wo jeeta**. Keyless models sabse tez hain (chhote purane models hain), to practically har request wahi jeetta tha. Aapki Gemini/Groq key laga bhi hoti to bhi kaam nahi aati.

Aur consensus path mein timeout **5 second** tha — Gemini/Groq ko sochne ka waqt hi nahi milta tha.

### Masla #3 — Aadhe model IDs dead the

OpenRouter ki live list se compare kiya. Code mein likhe **6 IDs ab exist hi nahi karte** (404):

```
❌ meta-llama/llama-3.3-70b-instruct:free
❌ deepseek/deepseek-r1:free
❌ deepseek/deepseek-chat-v3.1:free
❌ google/gemma-3-12b-it:free
❌ qwen/qwen3-coder:free
❌ mistralai/mistral-7b-instruct:free
❌ openai/gpt-oss-120b:free
```

Har call 404 → silent `catch {}` → keyless fallback → purana jawab.

### Masla #4 — Web research kaam hi nahi karta tha

`webResearch()` Bing ko `r.jina.ai` se scrape karta tha (ab block hai) aur Wikipedia ka title guess karta tha (`"what_is_the_latest_iphone"` — kabhi match nahi hota). To "latest/current" sawalon par model ke paas **zero fresh data** hota tha.

### Masla #5 — System prompt kaafi nahi tha

Sirf `CURRENT DATE: ...` likhna kaafi nahi. 2023 ka model date maan leta hai magar facts phir bhi 2023 ke deta hai.

---

## ✅ Kya fix hua

| # | Fix | File |
|---|---|---|
| 1 | Ek central verified model registry | `src/lib/modelRegistry.ts` (naya) |
| 2 | Keyless models rank 90+ — sirf last resort, warning ke saath | `modelRegistry.ts` |
| 3 | 2-tier calling: asli providers pehle, keyless baad mein | `chat/route.ts`, `chat/master/route.ts` |
| 4 | Timeout 5s → 20-25s (acha model ko sochne do) | `chat/route.ts` |
| 5 | Saare dead IDs hataye, live-verified se badle | sab files |
| 6 | Web research rewrite: DDG HTML + DDG IA + Wikipedia search API | `src/lib/research.ts` (naya) |
| 7 | Temporal grounding prompt — model ko apni aukaat batao | `src/lib/aiCall.ts` (naya) |
| 8 | Errors ab visible (`X-Nexora-*` headers), silent catch khatam | `aiCall.ts` |
| 9 | Diagnostic endpoint | `/api/health/models?deep=1` |
| 10 | Verify script | `scripts/verify-models.mjs` |

---

## 🔑 Free providers — konsa lein

Sabse acha combo: **Gemini + Groq**. Dono free, dono 5 minute mein.

### 1. Google Gemini ⭐ SABSE ZAROORI

- **Link:** https://aistudio.google.com/apikey
- **Free:** 1,500 requests/day
- **Card:** nahi chahiye
- **Kyun:** sabse naya knowledge, aur **built-in web search grounding** — yehi "purane jawab" ka asli ilaj hai

```bash
GEMINI_API_KEY=AIza...
```

### 2. Groq ⭐ SABSE TEZ

- **Link:** https://console.groq.com/keys
- **Free:** 14,400 requests/day
- **Card:** nahi chahiye
- **Kyun:** ~2,600 tokens/sec — instant lagta hai

```bash
GROQ_API_KEY=gsk_...
```

### 3. Cerebras (optional)

- **Link:** https://cloud.cerebras.ai
- **Free:** 1,000,000 tokens/day
- **Note:** free tier par context 8K tak limited hai

```bash
CEREBRAS_API_KEY=csk-...
```

### 4. OpenRouter (optional)

- **Link:** https://openrouter.ai/keys
- **Free:** 16 models jinki ID `:free` par khatam hoti hai (Nemotron 550B, Gemma 4, GPT-OSS 20B…)
- **Kyun:** ek key se bohot variety, consensus mode ke liye acha

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## 📋 Poora setup

```bash
cd Nexora

# .env banayein
cp .env.example .env

# apni keys daalein (nano/vim/code jo pasand ho)
nano .env
```

`.env` aisa dikhna chahiye:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
CEREBRAS_API_KEY=csk-...
OPENROUTER_API_KEY=sk-or-v1-...
```

Phir:

```bash
npm install
node scripts/verify-models.mjs   # sab models live check
npm run dev
```

---

## 🩺 Jab jawab phir kharab lagen

**Pehla qadam — hamesha:**

```
http://localhost:3000/api/health/models?deep=1
```

Ye har model ko asli call karta hai aur batata hai:

- `dead[]` — kaunse IDs 404 de rahe hain (provider ne retire kar diya)
- `lying[]` — kaunsa model apna cutoff registry se alag bata raha hai
- `research.working` — web research chal rahi hai ya nahi
- `keylessOnly: true` — ⚠️ iska matlab koi key set nahi, purane jawab milenge

**Ya terminal se:**

```bash
node scripts/verify-models.mjs
```

### Common problems

| Alamat | Wajah | Ilaj |
|---|---|---|
| "Koi AI provider configured nahi" | koi key set nahi | Step 1-3 upar |
| Jawab ke neeche ⚠️ purana-model warning | asli providers fail hue | health endpoint dekhein |
| `dead[]` khaali nahi | provider ne model retire kiya | `verify-models.mjs` chala kar `modelRegistry.ts` update karein |
| `research.working: false` | DuckDuckGo block/network issue | network dekhein; Gemini grounding phir bhi kaam karegi |
| 429 errors | free tier limit khatam | dusra provider add karein |

---

## 🔄 Har mahine (2 minute maintenance)

Providers models retire karte rehte hain. Isi liye code phir purana ho jayega. Mahine mein ek baar:

```bash
node scripts/verify-models.mjs
```

Jo `*** DEAD ***` dikhe, usay `src/lib/modelRegistry.ts` mein script ki "LIVE FREE MODELS" list se badal dein.

Ab sab kuch **ek hi file** mein hai — pehle 4 alag jagah update karna parta tha, isi liye IDs purani reh jati thin.

---

## 🧠 Sabse ahem baat

**Koi bhi LLM apne training cutoff ke baad ki cheez nahi jaanta.** Chahe Gemini 3 ho ya GPT-5.

Fresh jawab ke do hi tareeqe hain:

1. **Web research** — sawal ke saath live data bhejo (Nexora ab ye karta hai; `needsResearch()` khud detect karta hai)
2. **Grounded models** — Gemini ka apna Google Search built-in hai

Isi liye **Gemini key sabse zaroori hai** — sirf naye knowledge ki wajah se nahi, balke uski search grounding ki wajah se.
