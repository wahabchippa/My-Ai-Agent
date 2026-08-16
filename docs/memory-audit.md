# Memory ka audit — "kyun memory nahi hai?" (16 Aug 2026)

Chhota jawab: **memory maujood hai, magar teen alag qism ki hai aur teenon
adhoori hain.** Agents ko to bilkul bhi nahi milti.

---

## Jo cheezen pehle se maujood hain

| Cheez | File | Halat |
|---|---|---|
| `memories` table | `src/db/schema.ts:177` | ✅ maujood |
| `conversations` table | `src/db/schema.ts:317` | ✅ maujood, `messages` JSON ke sath |
| `recallMemories()` / `rememberFact()` / `extractFact()` | `src/lib/memory.ts` | ✅ likhi hui |
| `/api/state` | 74 lines | ✅ per-user conversations save karta hai |

Yani bunyaad rakhi hui hai. Masla judai ka hai.

---

## Teen qism ki memory — aur kis ke paas kya hai

| | `/api/chat` | `/api/chat/master` | **`/api/agents`** |
|---|---|---|---|
| Baat-cheet ki history | ✅ | ✅ | ❌ |
| Lambi-muddat memory (`memories`) | ✅ | ❌ | ❌ |
| DB me mehfooz | ✅ | ✅ | ❌ |

`memory.ts` ko **sirf `/api/chat/route.ts:12`** import karta hai. Baqi dono
routes ko us ka pata bhi nahi.

---

## Masla 1: `/api/agents` `messages` ko nazarandaz karta hai

Route sirf `body.task` (ya `body.message`) parhta hai. `messages` array kabhi
parha hi nahi jata — grep me `messages` ka count **0** hai.

### Live saboot

Poori history bheji gayi:

```json
{"messages":[
  {"role":"user","content":"Build a JS function add(a,b)"},
  {"role":"assistant","content":"function add(a,b){return a+b}"},
  {"role":"user","content":"ab is me type checking add karo"}
]}
```

Agent ka jawab:

> "**Aap ne original code attach nahi kiya**, is liye main ek production-ready
> **Python** example de raha hoon…"

Do galtiyan aik saath: (1) history mil rahi thi magar dikhi nahi, (2) sawal
JavaScript ka tha, jawab Python me aaya — kyunki context ke baghair usay
zaban ka andaza lagana para.

Ye kisi model ki kamzori nahi. Route ne data phenk diya jo usay bheja gaya
tha.

---

## Masla 2: `memories` table me `userId` HI NAHI hai

```ts
export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Koi `userId` column nahi. `recallMemories()` bhi bina kisi filter ke
`ORDER BY created_at DESC LIMIT n` karta hai.

**Nateeja:** agar do users app istemal karen, to A ki "mera naam Wahab hai"
B ke jawab me aa sakti hai. Ye sirf feature ki kami nahi — ye **privacy
ka masla** hai.

Baqi har table (`conversations`, `projects`, `userState`) me `userId` hai.
Sirf `memories` chhoot gayi.

---

## Masla 3: memory banti hi shaz-o-nadir hai

`extractFact()` teen regex par chalta hai:

1. `remember that X` / `yaad rakh X` — sirf jab user saaf kahe
2. `my name is X` / `mera naam X`
3. `I like/prefer/work as/live in X`

Yani memory tabhi banti hai jab user **jaan boojh kar** kahe. Baat-cheet se
khud kuch nahi seekha jata:

- "main Next.js 16 par kaam kar raha hoon" → ❌ yaad nahi rahega
- "hamesha TypeScript use karna, JS nahi" → ❌ yaad nahi rahega
- "mujhe chhote jawab pasand hain" → ❌ (`i like` pattern se match ho sakta
  hai, magar `mujhe … pasand hai` Roman Urdu wala pattern narrow hai)

Asal memory wo hai jo **khud** ye samajh le ke kya yaad rakhne layak hai.

---

## Karna kya hai — tarteeb ke sath

### 1. `memories` me `userId` daalo (~15 lines) — **security**
Migration + `recallMemories(userId, query)` aur `rememberFact(userId, fact)`.
Ye sab se pehle, kyunki abhi ye leak hai.

### 2. `/api/agents` me history joRo (~60 lines) — **sab se zyada faida**
`body.messages` parho, aakhri 3-4 turns aur pichhla deliverable context me
daalo. `/api/chat/master` me ye pattern pehle se maujood hai — wahan se
uthao. Isi se follow-up ("ab is me validation add karo") kaam karega.

### 3. `memory.ts` ko `master` + `agents` se joRo (~20 lines)
Teen jagah teen alag bartav ka koi jawaz nahi.

### 4. Fact extraction model se karao (~40 lines)
Har baat-cheet ke baad ek chhota call: "is guftagu me aisi koi baat hai jo
aainda ke liye yaad rakhni chahiye? sirf JSON list do, warna khaali." Regex
se kahin behtar, aur sasta bhi (chhota prompt, chhota jawab).

**Had:** ye har request par ek extra call hai. Sirf tab chalao jab guftagu
mukammal ho, har turn par nahi.

---

## Ek jumle me

Memory ke saare purze codebase me maujood hain — table, helper functions,
per-user state API. Masla ye hai ke `memory.ts` sirf ek route se juda hai,
`memories` table user ke hisab se alag nahi hoti, aur `/api/agents` us
history ko bhi phenk deta hai jo usay bheji ja rahi hai.
