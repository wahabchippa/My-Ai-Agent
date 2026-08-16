# Agent Upgrade — kya kya theek hua

Aap ne kaha "bas isko powerful banao, khud faisla karo". Ye kiya gaya.

---

## 1. Web / GitHub padhna — jo bilkul kaam nahi kar raha tha

**Shakayat:** public GitHub repo ka link diya, agent bola *"main web search
nahi kar sakta"*.

**Teen alag wajah thin:**

**(a) URL par research trigger hi nahi hota tha.**
`needsResearch()` ek keyword regex tha (`latest|news|price|...`). URL me ye
lafz nahi hote. Napa hua:

```
'https://github.com/x/y check karo'   -> NO TRIGGER
'is repo ko dekho github.com/a/b'     -> NO TRIGGER
```

**(b) Diye hue URL ko KHOLNE ka koi raasta hi nahi tha.** `research()` sirf
DuckDuckGo/Wikipedia par *search* karta hai. Link kholna alag cheez hai —
wo feature mojood hi nahi tha.

**(c) System prompt me kahin nahi likha tha ke ye salahiyat hai.** Model
apni training se keh deta tha "I cannot browse".

**Ab:** naya `src/lib/webFetch.ts` —
- `github.com/a/b` bina `https://` ke bhi pakarta hai
- GitHub ke liye API: stars, forks, languages %, file tree, poora README
- Aam pages: seedha fetch, nakaam ho to `r.jina.ai` fallback
- Repo private/404 → saaf likhta hai *"andaza mat lagao"*

**Live test:**

| Input | Nateeja |
|---|---|
| `github.com/wahabchippa/Nexora` | 1423 chars, sahi tafseel ✅ |
| `example.com` | asli mazmoon ✅ |
| `github.com/vercel/next.js` (bina https) | 141,794 stars ✅ |
| private repo | *"private hai ya mojood nahi"* — **jhoot nahi bola** ✅ |

---

## 2. Guftagu ki yaadasht

`/api/agents` `messages[]` parse karta tha aur **chup chaap phenk deta tha**.
Har turn "pehla turn" tha.

**Pehle:**
> "ab isko Python me convert karo" → agent naya, be-rabt Python example deta

**Ab:**
> → *"Python equivalent of the earlier JavaScript function"* + sahi code

Frontend bhi theek kiya — wo sirf `{ task }` bhejta tha, is liye backend ki
memory istemal hi nahi hoti. Ab `messages[]` jata hai, header me
**"💬 N turns yaad"** badge dikhta hai, aur *"New task"* context mitata nahi
(us ke liye alag *"Clear context"* button hai).

---

## 3. Agent ab apna code CHALA kar dekhta hai

Ye sab se bara gap tha. `/api/execute` repo me **pehle se mojood tha magar
koi use nahi karta tha**. Agent code likhta tha aur bas de deta tha.

**Ab** (`src/lib/verify.ts`): jawab me JS ho to wo asal me chalta hai. Toota
ho to agent ko error dikha kar **ek dafa theek karne ka mauqa** milta hai.

Jawab me naya field: `verified: passed | failed | not-verifiable | null`
UI me badge: **✓ code verified** / **✓ auto-fixed** / **⚠ code failed**

### Do baariq faisle

**"not-verifiable" ≠ "failed".** Express server ya `fetch` wala code ghalat
nahi hota — bas sandbox me chal nahi sakta. Usay fail ginna jhoot hota.

**`/api/execute` ko saaf `return` chahiye,** warna `result: null` aata hai
aur error bhi nahi — yani *"chal gaya"* aur *"kuch hua hi nahi"* me farq
nahi rehta. Is liye sirf function define karne wale code ko hum khud chand
aam inputs par bula kar dekhte hain. `TypeError`/`ReferenceError` = asli bug;
domain error = code chala, bas input ghalat tha.

**Live test:**
```
isPalindrome likhwaya      -> verified: passed (48.0s)
toota code (notDefined)    -> 'notDefined is not defined' pakra gaya
python code                -> 403 -> not-verifiable (fail NAHI)
```

---

## 4. Leak check har agent par

`looksLikeThinking()` sirf synthesis par lagta tha. Magar jab ek hi agent
kaamyab ho, `stitched()` raw output seedha user ko de deta tha — bakbak ke
sath. Isi test me Logos ne `1. **Analyze User Input:**` wali poori planning
bhej di thi.

Ab har agent ka output guzarta hai; leak ho to wo model rad, agla try.

---

## Do bugs jo khud test karne se nikle

**1. `ReferenceError: Cannot access 'M' before initialization`**
`AGENT_NAMES` ko module scope par le jate waqt wo helper ke *baad* reh gaya.
**Build pass ho gaya tha** — sirf runtime par har request 500 deti thi. Agar
seedha deploy kar deta to production toot jata.

**2. `verified: null` jabke code mojood tha**
Run 47s laga, budget 52s, shart `timeLeft > 12s` — 5s bache to verify chali
hi nahi. Ab `VERIFY_RESERVE_MS = 4s` synthesis se pehle reserve hota hai.

---

## Ab ka nateeja

| | Pehle | Ab |
|---|---|---|
| URL/GitHub padhna | ❌ "nahi kar sakta" | ✅ asal me padhta hai |
| Pichli baat yaad | ❌ | ✅ 6 turns |
| Code chala kar check | ❌ | ✅ + auto-fix |
| Leak protection | sirf synthesis | har agent |
| Sab se naya model | Groq (2023-24) | Agnes (Jul 2026) |

## Aap ka ek kaam

**Vercel me ye do env vars daalein:**
- `AGNES_API_KEY` — warna production me Agnes chalu nahi hoga
- `GITHUB_TOKEN` (marzi) — GitHub rate limit 60/hr se 5000/hr ho jayegi
