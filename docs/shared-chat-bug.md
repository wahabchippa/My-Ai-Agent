# "Har email par ek jaisi chat aati hai" — 3 bugs

User ki shakayat: kisi bhi email se login karo, sab ko **ek jaisi chat**
milti hai. Teen alag bugs mil kar ye shakal bana rahe the.

---

## Bug 1 — localStorage key sab users ke liye EK thi

`src/lib/store.tsx:72`

```ts
const LS_KEY = "claude-replica-v1";   // fixed string
```

Poora state isi ek key par likha ja raha tha. Login kisi bhi email se ho,
`load()` wahi **ek** entry parhta tha. Yani ek browser = ek chat, chahe 10
users login karein.

**Fix:** key ab per-user hai.

```ts
const LS_PREFIX = "nexora-store-v2";
function lsKeyFor(userId: number | null) {
  return userId == null ? `${LS_PREFIX}:guest` : `${LS_PREFIX}:u${userId}`;
}
```

## Bug 2 — har naye user ko wahi banawati "Welcome" chat milti thi

`seedConversations()` ek hardcoded chat banata tha ("Welcome to Nexora" +
ek sawal + ek jawab). Har naya user yehi dekhta tha — is se taathur aur
pukhta hota tha ke "sab ki chat same hai".

**Fix:** naya user ab **khali** sidebar se shuru karta hai.

## Bug 3 (asli mujrim) — `/api/state` HAR request par 401 deta tha

Ye sab se chhupa hua tha. `sessions.token` column me token ka **SHA-256
hash** mehfooz hota hai (`auth.ts` → `hashToken()`), magar helper cookie ka
**raw** token seedha compare kar raha tha:

```ts
.where(eq(sessions.token, token))    // hash vs raw — kabhi match nahi
```

Nateeja: theek login hone ke bawajood `/api/state` hamesha
`401 Not logged in`. **Isi liye Neon ki `user_state` table me 0 rows thin.**

`/api/auth/me` theek chal raha tha kyunke wo `validateSession()` use karta
hai jo hash karta hai — bas ye ek helper reh gaya tha.

**Fix:** `hashToken(token)` se compare + expiry check.

---

## Sath me: ab chat waqai Neon me jati hai

Pehle `store.tsx` ka comment tha: `// persist — localStorage only`.
Ab:

1. Mount par `/api/auth/me` → userId
2. Us user ka localStorage foran load (screen khali na rahe)
3. Phir `/api/state` se Neon ka data (logged-in ho to server hi asli sach)
4. Har tabdeeli: localStorage foran + Neon par **2s debounced** PUT
5. `hydrated` flag — jab tak load na ho, save nahi (warna khali state asli
   data par chal jati)

## Aur: logout par reload

`useAuth.ts` ka `logout()` page reload nahi karta tha. `StoreProvider` apna
userId sirf mount par leta hai — bina reload ke purane user ki chat memory
me pari rehti aur agla login karne wala **wohi chat dekhta**. Ab
`window.location.href = "/"`. (Har user ka localStorage apni key par
mehfooz rehta hai, mit'ta nahi.)

---

## Live test (do asli users, Neon ke sath)

```
A save -> {"ok":true}
B save -> {"ok":true}
A ko mila: ['ALPHA ka raaz']
B ko mila: ['BETA ka raaz']
bina login: {"error":"Not logged in"}
```

Neon:

```
user_state rows: 2
  user 2 -> {"conversations":[{"id":"a1","title":"ALPHA ka raaz"}]...
  user 3 -> {"conversations":[{"id":"b1","title":"BETA ka raaz"}]...
```

Pehle ye table **0 rows** thi.

---

## Purane users ka kya hoga

localStorage prefix `claude-replica-v1` se `nexora-store-v2` ho gaya, is
liye maujooda browser ki purani chat sidebar me nazar nahi aayegi. Ye
jaanbujh kar hai — wo data kis user ka hai, ye jaanne ka koi tareeqa nahi
(sab ne ek hi key share ki thi). Purani entry browser me mehfooz rehti hai,
mitai nahi gayi.
