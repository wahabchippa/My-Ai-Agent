# Nexora ko smart kaise banayen — imaandaar audit (16 Aug 2026)

Sawal tha: "mera AI agent aur smart kaise hoga?"

Char round naye API providers dhoondne me lagaye. Natija: **1 naya provider**
(OpenCode Zen). Ye batata hai ke asal rukawat model nahi hai.

Ye document code parh kar likha gaya, andaze se nahi. Har daawa ke saath us
ki file aur line hai.

---

## Sab se bari kamzori: agent apna kaam JAANCHTA nahi

Nexora me `/api/execute` pehle se maujood hai (63 lines) — JS ko sandbox me
chalata hai, `console.log` capture karta hai, khatarnak globals block karta
hai.

`/api/agents` me `execute` ka zikr **0 dafa** aata hai.

Yani Forge code likhta hai, Vesta review karta hai, Aegis test likhta hai —
aur **kisi ne kabhi wo code chala kar nahi dekha**.

### Ye maine sabit kiya, farz nahi kiya

Agent se `isPalindrome` mangwaya, phir uska code `/api/execute` ko bheja:

```
agent ka code:  437 chars (two-pointer, typeof guard, regex clean)
execute result: PASS:"A man, a plan, a canal: Panama" | PASS:"race a car"
                | PASS:"" | PASS:"ab"
```

**4/4 pass.** Code sahi tha. Magar agent ko ye maloom nahi tha — usne bharosa
kiya. Agar galat hota, tab bhi utne hi aitmaad se pesh karta.

Aaj Vesta/Aegis ka "review" sirf **model ki raaye** hai. Chalane ke baad wo
**saboot** ban jata hai.

### Karna kya hai

`build` wave me teesra qadam: Forge ka code + Aegis ke tests `/api/execute`
ko bhejo. Agar fail ho → error output ke sath Forge ko wapas do ("ye test
fail hua: …, theek karo"). Ye **execution feedback loop** hai — asli coding
agents (Devin, Cursor, Claude Code) ki bunyadi cheez.

Mehnat: ~80 lines. Faida: sab se zyada.
**Had:** `/api/execute` sirf JS chalata hai. Python code par ye kaam nahi
karega — us ke liye `logs` me `SyntaxError` aayega, jise pakar kar "verify
nahi kar sake" kehna hoga, jhoota PASS nahi dena.

---

## Doosri kamzori: har sawal bhool jata hai

`/api/agents` sirf `task: string` leta hai. `messages` array kahin nahi.

```
User: "Build a login form in React"       → agent banata hai
User: "ab is me validation add karo"      → agent: "kis me?"
```

Poora feature **single-shot** hai. Follow-up mumkin hi nahi.

### Karna kya hai

`body.messages` accept karo (jaise `/api/chat/master` karta hai). Pichhli
baat-cheet ka aakhri deliverable context me daalo. UI me "New task" ke
saath-saath "follow up" ka rasta do.

Mehnat: ~60 lines + UI. Faida: feature ek-baar ke demo se asli auzaar ban
jata hai.

---

## Teesri kamzori: research bohot kamzor hai

`src/lib/research.ts` — DuckDuckGo + Wikipedia + Wikidata. Theek hai.

Masla `needsResearch()` me hai (line 202) — ek **hardcoded keyword regex**:

```
latest|newest|current|news|price|bitcoin|president|weather|...
```

Ye in par fail hota hai:
- "Nexora ke muqable me kaun se tools hain" → koi keyword nahi → **research
  nahi hoti** → model 2024 ki yaadash se jawab deta hai
- "Next.js 16 me caching kaise kaam karti hai" → keyword nahi → model purani
  API bata dega

Ulta bhi: "explain how **current** flows in a circuit" → "current" match →
bekaar web search.

### Karna kya hai

Do behtari, dono saste:
1. `classifyTask` ka natija istemal karo — `research` kind hamesha research
   kare, chahe keyword ho ya na ho.
2. Model se hi poochho (1 chhota call, ~300ms): "is sawal ke liye web chahiye?
   sirf YES/NO". Keyword list se kahin behtar.

---

## Chauthi: agent tools istemal nahi karte

Har agent ke paas sirf ek salahiyat hai — **text likhna**. Koi agent:
- calculator nahi chala sakta (Nova "Data Analyst" hai magar jama-tafreeq bhi
  anumaan se karta hai)
- file nahi parh sakta
- apna kaha hua verify nahi kar sakta

Kam se kam `evaluate(expression)` aur `run_js(code)` do tools dena chahiye.
`/api/execute` pehle se maujood hai — sirf agent loop se joRna hai.

---

## Panchvi: Scribe aur Nova kabhi chalte hi nahi

`selectWaves()` me 8 me se sirf 6 specialists aate hain:

| kind | team |
|---|---|
| build | engineer → reviewer + tester |
| review | reviewer + tester |
| research | researcher → analyst |
| write | writer |
| data | data → analyst |
| general | researcher → analyst |

**Scribe (documenter) kisi bhi wave me nahi hai.** Nova sirf `data` par, jo
classifier shazo-nadir hi chunta hai.

Do rasté: ya `build` ke baad Scribe ka wave laga do (README/docstrings), ya
Scribe ko hata do. Aisa specialist rakhna jo kabhi na chale, sirf UI me
jhooti raunaq hai.

---

## Chhati: quality napi nahi jati

Koi eval set nahi. Har badlav ke baad "behtar hua?" ka jawab andaza hai.

20 tasks ka chhota set (10 build, 5 review, 5 research) + har ek ka
expected checkpoint. Har badlav ke baad chalao. Bina napy behtari ka daawa
sirf ummeed hai.

---

## Tarteeb (faida ÷ mehnat)

| # | Kaam | Mehnat | Faida |
|---|---|---|---|
| 1 | **Execution loop** — code chala kar theek karao | ~80 L | 🔥🔥🔥 |
| 2 | **Conversation memory** — follow-up | ~60 L | 🔥🔥🔥 |
| 3 | **Smart research trigger** | ~25 L | 🔥🔥 |
| 4 | **Tools** (calculator, run_js) | ~120 L | 🔥🔥 |
| 5 | Scribe ka faisla | ~15 L | 🔥 |
| 6 | Eval set | ~150 L | 🔥🔥 (roz nahi dikhta) |

---

## Jo NAHI karna chahiye

- **Aur providers dhoondna.** Char round ho chuke. 100+ providers, 20+ live
  probes, 1 kaam ka natija. Kuan sookh chuka hai.
- **Aur agents add karna.** 8 me se 2 pehle hi bekaar khare hain. 9waan
  jorna masla barhayega, ghatayega nahi.
- **Koi gateway (LiteLLM/FreeRide) apnana.** Wo wohi karte hain jo
  `pickModels()` karta hai, aur ek nayi service host karni parti hai.

---

## Ek jumle me

Nexora ka agent is liye kamzor nahi ke uske paas achhe model nahi — is liye
ke wo **apna kaam kabhi jaanchta nahi, aur pichhli baat yaad nahi rakhta.**
Dono ke auzaar (`/api/execute`, `sanitizeMessages`) codebase me pehle se
maujood hain, bas jure hue nahi hain.
