/**
 * i18n — detects the user's language (English / Hindi / Roman Urdu) and serves
 * localized phrasing so Claude replies in the language the user is writing in.
 */

export type Lang = "en" | "hi" | "ur";

const URDU_WORDS = [
  "kya", "kaise", "kaisa", "kaisi", "hai", "hain", "ho", "kar", "karo", "bana",
  "banao", "mujhe", "aap", "tum", "mera", "meri", "tera", "kyun", "kyu", "nahi",
  "haan", "theek", "achha", "accha", "bhi", "aur", "ka", "ki", "ke", "ne", "se",
  "ko", "mein", "hum", "ham", "yaar", "zara", "thoda", "bahut", "bohot", "sahi",
  "galat", "kuch", "Sab", "sab", "ya", "lekin", "magar", "abhi", "kal", "aaj",
  "wala", "wali", "janab", "shukriya", "meharbani", "khana", "paani", "dost",
];

export function detectLang(text: string): Lang {
  // Devanagari script → Hindi
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  const lower = " " + text.toLowerCase().replace(/[^a-z\s']/g, " ") + " ";
  let hits = 0;
  for (const w of URDU_WORDS) {
    if (lower.includes(" " + w + " ")) hits++;
  }
  if (hits >= 2) return "ur";
  return "en";
}

export function langName(l: Lang): string {
  return l === "hi" ? "Hindi" : l === "ur" ? "Roman Urdu" : "English";
}

/* Localized phrase sets per intent */
type Dict = Record<string, string>;

const HELLO: Dict = {
  en: "Hello there! 👋 I'm **Nexora**. I can write, brainstorm, analyze, code — and even **build live, working apps** you can preview instantly. What are we making today?",
  hi: "नमस्ते! 👋 मैं **Nexora** हूँ। मैं लिखना, आइडिया देना, कोड लिखना — और **live काम करने वाली apps बनाना** भी जानता हूँ जिनका preview तुरंत दिख जाए। आज क्या बनाएँ?",
  ur: "Assalamualaikum! 👋 Main **Nexora** hoon. Main likhna, ideas dena, code likhna — aur **live kaam karne wali apps banana** bhi jaanta hoon jin ka preview fauran mil jaye. Aaj kya banayein?",
};

const IDENTITY: Dict = {
  en: "I'm **Nexora**, your AI assistant. I can write and edit, reason through problems, write and debug code, and build working web apps you can preview live. What would you like to do?",
  hi: "मैं **Nexora** हूँ, आपका AI assistant। मैं लिखना, सोच-समझकर जवाब देना, कोड लिखना/ठीक करना, और **live preview के साथ web apps बनाना** सब कर सकता हूँ। आप क्या करना चाहेंगे?",
  ur: "Main **Nexora** hoon, aap ka AI assistant. Main likhna, soch-samajh kar jawab dena, code likhna/theek karna, aur **live preview ke saath web apps banana** sab kar sakta hoon. Aap kya karna chahenge?",
};

const CAPS: Dict = {
  en: "Here's what I can do:\n\n**Build apps & websites** 🛠️\nSay *“build a calculator”*, *“make a todo app”* or *“create a website for my cafe”* — I'll generate working code **and a live preview** side by side.\n\n**Code** 💻\nWrite, explain and debug in Python, JavaScript, React, HTML/CSS and more.\n\n**Write & think** ✍️\nEssays, stories, brainstorming, summaries and clear explanations.\n\n**Everyday help**\nMath, planning, translation — in English, हिंदी, or Roman Urdu.\n\nTry asking me to build something!",
  hi: "मैं ये सब कर सकता हूँ:\n\n**Apps और websites बनाना** 🛠️\nबस कहिए *“calculator बना दो”*, *“todo app बनाओ”* या *“मेरे cafe की website बनाओ”* — मैं काम करता हुआ code **और live preview** दोनों दूँगा।\n\n**कोड** 💻\nPython, JavaScript, React, HTML/CSS में लिखना, समझाना और ठीक करना।\n\n**लिखना और सोचना** ✍️\nनिबंध, कहानियाँ, ideas, summary और आसान explanation।\n\n**रोज़मर्रा की मदद**\nMath, planning, translation — English, हिंदी या Roman Urdu में।\n\nकुछ बनवाकर देखिए!",
  ur: "Main yeh sab kar sakta hoon:\n\n**Apps aur websites banana** 🛠️\nBas keh dijiye *“calculator bana do”*, *“todo app banao”* ya *“meray cafe ki website banao”* — main kaam karne wala code **aur live preview** dono dunga.\n\n**Code** 💻\nPython, JavaScript, React, HTML/CSS mein likhna, samjhana aur theek karna.\n\n**Likhna aur sochna** ✍️\nMazameen, kahaniyan, ideas, summary aur aasan explanation.\n\n**Roz marra ki madad**\nMath, planning, translation — English, Hindi ya Roman Urdu mein.\n\nKuch banwa kar dekhiye!",
};

const THANKS: Dict = {
  en: "You're very welcome! 😊 Anything else?",
  hi: "कोई बात नहीं! 😊 और कुछ चाहिए?",
  ur: "Koi baat nahi, shukriya! 😊 Aur kuch chahiye?",
};

const JOKE: Record<Lang, string[]> = {
  en: [
    "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
    "There are 10 kinds of people: those who understand binary, and those who don't.",
  ],
  hi: [
    "प्रोग्रामर dark mode क्यों पसंद करते हैं? क्योंकि रोशनी से bugs आकर्षित होते हैं! 🐛",
    "दुनिया में 10 तरह के लोग होते हैं — जिन्हें binary आती है, और जिन्हें नहीं।",
  ],
  ur: [
    "Programmers dark mode kyun pasand karte hain? Kyunke roshni se bugs aakarshit hote hain! 🐛",
    "Duniya mein 10 tarah ke log hote hain — jinhein binary aati hai, aur jinhein nahi.",
  ],
};

const BUILD_INTRO: Record<Lang, string> = {
  en: "Done! Here's a complete, working version. The **live preview and the code are both shown** in the panel on the right — you can edit, copy, or open it fullscreen. Want me to change colors, text, or add features?",
  hi: "हो गया! ये रही पूरी काम करने वाली version। **Live preview और code दोनों** दाईं तरफ panel में दिख रहे हैं — आप colors, text बदल सकते हैं या features जोड़ सकते हैं। बताइए क्या बदलना है?",
  ur: "Ho gaya! Yeh rahi mukammal kaam karne wali version. **Live preview aur code dono** dayein taraf panel mein dikh rahe hain — aap colors, text badal sakte hain ya features add kar sakte hain. Batayein kya badalna hai?",
};

const DEFAULT_INTRO: Record<Lang, string> = {
  en: "Good question — here's my take.",
  hi: "अच्छा सवाल — ये रहा मेरा जवाब।",
  ur: "Achha sawaal — yeh raha mera jawab.",
};

export function phrase(intent: "hello" | "identity" | "caps" | "thanks", lang: Lang) {
  const map = { hello: HELLO, identity: IDENTITY, caps: CAPS, thanks: THANKS };
  return map[intent][lang];
}

export function pickJoke(lang: Lang) {
  const arr = JOKE[lang] ?? JOKE.en;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildIntro(lang: Lang) {
  return BUILD_INTRO[lang];
}

export function defaultIntro(lang: Lang) {
  return DEFAULT_INTRO[lang];
}
