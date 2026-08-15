/**
 * knowledge — a compact, curated knowledge base so the offline brain can give
 * genuinely useful, accurate, Claude-style answers on common topics. The
 * matcher scores topic relevance by keyword overlap and returns the best hit.
 */

export interface KBEntry {
  keys: string[];
  answer: string;
}

export const KNOWLEDGE: KBEntry[] = [
  {
    keys: ["artificial intelligence", "ai", "what is ai", "artificial"],
    answer:
      "Here's the clean way to think about **artificial intelligence**.\n\nAt its core, AI is software that performs tasks we'd normally call *intelligent* — recognizing images, understanding language, making predictions, or solving problems. Modern AI is almost entirely **machine learning**: instead of hand-writing rules, we feed a system lots of examples and it learns patterns from them.\n\nThe three ideas that matter:\n\n1. **It learns from data** — performance improves with more, better examples.\n2. **It's probabilistic, not certain** — it guesses the most likely answer, which is why it can be wrong.\n3. **It's a tool, not a mind** — it has no understanding or intent; it pattern-matches.\n\nThe biggest jump recently was **large language models (LLMs)** like me, trained on huge amounts of text to predict the next word — which turns out to require modeling a surprising amount of how the world works.\n\nWant me to go deeper on any one of these?",
  },
  {
    keys: ["machine learning", "ml", "what is machine learning"],
    answer:
      "**Machine learning** is how most modern AI actually works.\n\nThe key shift: instead of a programmer writing explicit rules (*\"if the email contains 'lottery', mark it spam\"*), you show the system thousands of labeled examples and let it **discover the rules itself**.\n\nThe three main flavors:\n\n- **Supervised learning** — you give labeled data (emails marked spam/not spam) and it learns to predict labels for new inputs.\n- **Unsupervised learning** — no labels; it finds structure on its own (grouping similar customers, say).\n- **Reinforcement learning** — it learns by trial and error, earning rewards for good choices (how game-playing bots are trained).\n\nA simple mental model: it's **curve-fitting at scale**. Find the function that best maps inputs to outputs, then use it on new data. Want a concrete example with code?",
  },
  {
    keys: ["neural network", "neural networks", "deep learning", "what are neural networks"],
    answer:
      "A **neural network** is a machine-learning model loosely inspired by the brain.\n\nPicture layers of simple math units called **neurons**. Data goes in the first layer, each layer transforms it and passes it on, and the last layer produces the answer (like \"this image is a cat\").\n\nHow it learns:\n\n1. It makes a guess on an example.\n2. We measure how wrong it was (the **loss**).\n3. Tiny adjustments (**backpropagation**) nudge every connection to reduce that error.\n4. Repeat millions of times until the guesses get good.\n\n\"Deep\" learning just means **many layers**, which lets the network learn rich, layered features — edges first, then shapes, then objects. That stacking of abstraction is why deep networks are so powerful for vision, language, and speech.",
  },
  {
    keys: ["large language model", "llm", "language model", "gpt", "transformer", "chatgpt", "how do you work", "how does chatgpt"],
    answer:
      "Here's how a **large language model** (like me) actually works.\n\nFundamentally, I'm trained to do one thing incredibly well: **predict the next token** (roughly a word or piece of a word) given the text so far. That sounds simple, but to predict well across billions of examples, the model has to internalize a lot about grammar, facts, reasoning, and style.\n\nThe architecture is the **Transformer**, whose superpower is **attention** — it can weigh which earlier words matter most for predicting the next one, so it handles long-range context well.\n\nTraining has stages:\n\n- **Pretraining** — read enormous amounts of text, learn to predict tokens.\n- **Fine-tuning & RLHF** — humans shape responses to be helpful, honest, and safe.\n\nImportant truth: I don't *look things up* or *know* in a human sense — I generate fluent, plausible text based on patterns. I can be wrong, so treat confident-sounding answers with healthy skepticism.",
  },
  {
    keys: ["python", "python programming", "learn python"],
    answer:
      "**Python** is one of the most popular programming languages, and a great first language. Here's why and how to start.\n\n**Why people love it**\n- Readable, almost-English syntax — less ceremony, more doing.\n- Huge ecosystem: web (Django, Flask), data (pandas, NumPy), AI (PyTorch), automation, scripts.\n- Friendly, enormous community.\n\n**The essentials to learn first**\n1. Variables, numbers, strings, and f-strings.\n2. Lists, dictionaries, and loops.\n3. Functions and `if`/`else`.\n4. Reading errors and using `print()` to debug.\n\n**A tiny taste**\n```python\nnames = [\"ada\", \"lin\", \"grace\"]\nfor n in names:\n    print(f\"Hello, {n.title()}!\")\n```\n\nWant me to build you a small project to practice with — a calculator, a quiz, or a to-do list?",
  },
  {
    keys: ["javascript", "js", "what is javascript", "learn javascript"],
    answer:
      "**JavaScript** is the language of the web — it runs in every browser and, with Node.js, on servers too.\n\n**What it does**\n- Adds interactivity to web pages (clicks, animations, form validation).\n- Powers frameworks like React, Vue, and Angular.\n- Runs back-ends, build tools, desktop apps, and more.\n\n**The core ideas**\n1. Variables: `let` / `const`.\n2. Functions, including arrow functions: `(x) => x * 2`.\n3. The DOM — how JS reads and changes page elements.\n4. Async work with `async`/`await` and promises.\n\n**Hello world**\n```javascript\nconst greet = (name) => `Hello, ${name}!`;\nconsole.log(greet(\"world\"));\n```\n\nTell me what you want to build and I'll teach the exact pieces you need.",
  },
  {
    keys: ["react", "reactjs", "what is react", "jsx", "react component"],
    answer:
      "**React** is a JavaScript library for building user interfaces, made by Meta. It's the most popular way to build modern web apps.\n\n**The big ideas**\n\n- **Components** — UIs are split into reusable, self-contained pieces.\n- **JSX** — write HTML-like markup inside JavaScript.\n- **State** (`useState`) — data that, when changed, re-renders the component.\n- **Props** — how parents pass data to children.\n\n**A minimal component**\n```jsx\nimport { useState } from \"react\";\n\nfunction Counter() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>Clicked {n} times</button>;\n}\n```\n\nThe mental model: you describe *what the UI should look like for the current state*, and React figures out *how to update the screen*. Want a full working example in the preview panel?",
  },
  {
    keys: ["api", "rest api", "what is an api", "endpoints"],
    answer:
      "An **API** (Application Programming Interface) is how two pieces of software talk to each other.\n\nThink of it like a restaurant: **you** (the app) place an order, the **kitchen** (the server) makes it, and the **waiter** (the API) carries messages back and forth. You don't need to know how the kitchen works — just how to order.\n\n**A REST API in plain terms**\n- You make a **request** to a URL (an *endpoint*), usually with a method:\n  - `GET` — read data\n  - `POST` — create data\n  - `PUT`/`PATCH` — update\n  - `DELETE` — remove\n- The server replies with data, usually as **JSON**.\n\n**Example**\n```javascript\nfetch(\"https://api.example.com/users/1\")\n  .then((r) => r.json())\n  .then((user) => console.log(user.name));\n```\n\nWant me to build a tiny app that calls a real public API?",
  },
  {
    keys: ["git", "version control", "github", "git commit"],
    answer:
      "**Git** is a version-control system — essentially *save points for your code*. It tracks every change, lets you experiment safely, and makes collaboration possible.\n\n**The core loop**\n1. `git init` — start tracking a project (once).\n2. `git add .` — stage your changes.\n3. `git commit -m \"message\"` — save a snapshot.\n4. `git push` — upload to a remote like GitHub.\n\n**Why it's worth learning**\n- **History** — go back to any past state.\n- **Branches** — try ideas without breaking the main code: `git checkout -b my-feature`.\n- **Collaboration** — many people work in parallel and merge changes.\n\nGitHub is the website that *hosts* Git repositories and adds teamwork features like pull requests and reviews. Want a visual walkthrough of a real workflow?",
  },
  {
    keys: ["database", "sql", "what is a database", "relational", "tables"],
    answer:
      "A **database** is organized storage for data, designed so you can store, search, and update it efficiently — far better than spreadsheets for anything serious.\n\n**Relational databases** (PostgreSQL, MySQL, SQLite) store data in **tables** (rows and columns) and you query them with **SQL**:\n\n```sql\n-- Find everyone over 18 in Mumbai\nSELECT name, email\nFROM users\nWHERE age > 18 AND city = 'Mumbai'\nORDER BY name;\n```\n\n**Key terms**\n- **Table** — like a sheet (e.g., `users`).\n- **Row** — one record (one user).\n- **Column** — one field (e.g., `email`).\n- **Primary key** — a unique ID per row.\n- **Foreign key** — a link to another table.\n\nThere are also **NoSQL** databases (MongoDB) for flexible, document-shaped data. Want help designing one for a specific app?",
  },
  {
    keys: ["photosynthesis", "how do plants make food", "chlorophyll"],
    answer:
      "**Photosynthesis** is how plants turn sunlight into food. It's one of the most important processes on Earth.\n\n**The recipe**\n- **Inputs:** sunlight + water + carbon dioxide.\n- **Output:** glucose (sugar) + oxygen.\n\nIt happens mainly in the **leaves**, inside tiny structures called **chloroplasts**, which contain the green pigment **chlorophyll** (that's why leaves are green).\n\n**In a formula:**\n```\n6 CO₂ + 6 H₂O  --light-->  C₆H₁₂O₆ + 6 O₂\n```\n\n**Why it matters**\n- It's the base of nearly every food chain — plants feed themselves, then everything else.\n- It releases the **oxygen** we breathe.\n- It pulls **CO₂** out of the air, balancing the atmosphere.\n\nWant the version with the light-dependent and Calvin cycle steps too?",
  },
  {
    keys: ["gravity", "what is gravity", "newton", "general relativity", "why do things fall"],
    answer:
      "**Gravity** is the attraction between anything that has mass — and it's what keeps you on the ground and the planets in orbit.\n\n**Two ways to understand it**\n\n- **Newton's view:** every object pulls every other object, and the pull is stronger for heavier objects and shorter distances. `F = G·(m₁·m₂)/r²`.\n- **Einstein's view (General Relativity):** mass actually *bends spacetime*, and things simply follow the curves. As physicist John Wheeler put it: *\"Matter tells spacetime how to curve; spacetime tells matter how to move.\"*\n\n**Key facts**\n- It's the **weakest** of the four fundamental forces, but it dominates at large scales because it only adds up, never cancels.\n- It gives you **weight** (your mass × the local pull).\n- It's why a dropped ball and the Moon both \"fall\" — just along different curves.\n\nWant me to connect this to orbits or black holes?",
  },
  {
    keys: ["black hole", "black holes", "event horizon", "singularity"],
    answer:
      "A **black hole** is a region of space where gravity is so strong that **nothing — not even light — can escape**.\n\n**How they form**\nWhen a very massive star runs out of fuel, it collapses under its own gravity. If enough mass packs into a small enough point, the gravitational pull at the surface exceeds the speed of light — and a black hole is born.\n\n**The parts**\n- **Singularity** — the crushed core at the center, where our physics breaks down.\n- **Event horizon** — the *point of no return*. Cross it and you can never get back out.\n\n**Mind-bending facts**\n- Time itself slows down near one (extreme **time dilation**).\n- They're not cosmic vacuums — from far away, a black hole pulls on you just like a normal star of the same mass.\n- We've actually *photographed* one (the Event Horizon Telescope, 2019).\n\nWant to go deeper on time dilation or how we detect them?",
  },
  {
    keys: ["climate change", "global warming", "greenhouse effect", "carbon emissions"],
    answer:
      "**Climate change** is the long-term shift in Earth's temperatures and weather, driven mainly by human activity.\n\n**The mechanism — the greenhouse effect**\nCertain gases (CO₂, methane) trap heat like a blanket. We burn fossil fuels and clear forests, pumping extra CO₂ into the air → the blanket thickens → the planet warms.\n\n**Why it matters**\n- More frequent and intense **heatwaves, droughts, floods, and storms**.\n- **Rising seas** as ice melts and warm water expands.\n- Shifting ecosystems and stress on food and water supplies.\n\n**What helps**\n- Replace fossil fuels with **renewables** (solar, wind).\n- **Electrify** transport and heating, and clean up the grid.\n- Protect and restore **forests** and soils.\n- Use energy far more **efficiently**.\n\nThis is well-established science, with broad consensus among climate scientists. Want the data on what's changed so far?",
  },
  {
    keys: ["dna", "genetics", "genes", "what is dna", "double helix"],
    answer:
      "**DNA** is the molecule that stores the instructions for building and running a living thing — essentially a blueprint written in a chemical code.\n\n**The structure**\nIt's a **double helix** — two long strands twisted together, held by pairs of bases: **A–T** and **C–G**. The order of these letters *is* the information.\n\n**Key terms**\n- **Gene** — a section of DNA that codes for a specific trait or protein.\n- **Genome** — all of an organism's DNA.\n- **Chromosome** — a tightly packed bundle of DNA (humans have 23 pairs).\n\n**Why it's remarkable**\n- It **copies itself** when cells divide, so the instructions pass on.\n- Tiny changes (**mutations**) create the variation that evolution acts on.\n- Nearly every living thing shares the *same* four-letter code — powerful evidence of common ancestry.\n\nWant me to tie this to how traits are inherited?",
  },
  {
    keys: ["evolution", "natural selection", "darwin", "theory of evolution"],
    answer:
      "**Evolution** is how populations of living things change over generations — and it explains the diversity of all life on Earth.\n\n**The engine: natural selection**\n1. **Variation** — individuals in a population differ (via DNA mutations).\n2. **Inheritance** — those differences are passed to offspring.\n3. **Differential success** — traits that help survival and reproduction become more common over time.\n\nPut simply: **the individuals best suited to their environment tend to leave more offspring**, so their traits spread. Over immense time, this produces new species.\n\n**Important nuances**\n- It's not goal-directed or \"survival of the strongest\" — it's about *fit* to a specific environment.\n- It acts on **populations**, not individuals, across **deep time**.\n- It's supported by fossils, genetics, anatomy, and direct observation.\n\nWant an example, like how antibiotic resistance evolves?",
  },
  {
    keys: ["internet", "how does the internet work", "http", "world wide web", "tcp ip"],
    answer:
      "Here's how the **internet** actually works, without the jargon.\n\n**The one-line version:** it's a giant, global network of computers that send each other small **packets** of data.\n\n**When you visit a website**\n1. You type a domain (like `example.com`).\n2. **DNS** (the internet's phonebook) turns it into an IP address.\n3. Your browser sends an **HTTP request** to that server.\n4. The server sends back the page, in packets, which reassemble on your screen.\n\n**Two key distinctions**\n- The **internet** is the infrastructure — the wires, routers, and protocols (like TCP/IP) that move data.\n- The **World Wide Web** is just one service *on top of it* — pages you access via browsers and HTTP.\n\nThe genius is **packet switching**: data is broken up, routed many ways, and reassembled — so the network is robust and efficient. Want me to go deeper on any layer?",
  },
  {
    keys: ["blockchain", "bitcoin", "cryptocurrency", "crypto", "what is blockchain"],
    answer:
      "A **blockchain** is a special kind of database that's very hard to tamper with — and it underpins cryptocurrencies like Bitcoin.\n\n**The core idea**\nInstead of one company holding the records, a **ledger** is copied across thousands of computers. New transactions are grouped into **\"blocks\"** that are cryptographically chained to the previous one. Change an old block and every block after it breaks — so tampering is obvious.\n\n**How trust works without a middleman**\n- **Decentralization** — no single party controls it.\n- **Consensus** — computers (\"miners\"/\"validators\") agree on what's valid.\n- **Cryptography** — links and ownership are secured with math.\n\n**Honest caveats**\n- It's great for some things (auditable records, certain transfers) but slow and energy-heavy for others.\n- Crypto is volatile and risky; treat any investment with great caution.\n\nWant me to explain \"proof of work\" vs \"proof of stake\" next?",
  },
  {
    keys: ["quantum computing", "quantum computer", "qubit", "superposition"],
    answer:
      "**Quantum computing** is a fundamentally different way to compute, using the strange rules of quantum physics.\n\n**Classical vs. quantum**\n- A normal bit is **0 or 1**.\n- A **qubit** can be in a **superposition** — a blend of 0 and 1 at once. And qubits can be **entangled**, so their states link together.\n\n**Why it could be powerful**\nWith *n* entangled qubits, the system can represent and manipulate a huge combination of states in parallel. For certain problems — factoring large numbers, simulating molecules, optimization — this could be exponentially faster.\n\n**The honest reality**\n- Qubits are fragile; **decoherence** makes them lose state.\n- We're still early; today's machines are small and noisy.\n- They won't replace your laptop — they'll excel at *specific* problems.\n\nIt's not magic, and it won't break all encryption overnight. Want the simplified math of superposition?",
  },
  {
    keys: ["inflation", "economics", "what is inflation", "economy"],
    answer:
      "**Inflation** is the general rise in prices over time — which means each unit of currency buys a little less.\n\n**Why it happens**\n- **Demand-pull:** too much money chasing too few goods (high demand → prices rise).\n- **Cost-push:** when producing things gets more expensive (energy, materials, wages).\n- **Money supply:** if a lot more money is printed relative to goods, its value tends to fall.\n\n**A little is normal, even healthy** — most central banks target around **2%** a year. It encourages spending and investment rather than hoarding cash. The danger is when it runs **too hot** (savings evaporate) or goes **negative** (deflation stalls the economy).\n\n**Who gets hit**\nPeople on fixed incomes and savers lose ground; borrowers can benefit because debts are repaid in \"cheaper\" money. Central banks fight it mainly by **raising interest rates** to cool demand.\n\nWant me to explain interest rates or recessions next?",
  },
  {
    keys: ["startup", "how to start a business", "business idea", "entrepreneur"],
    answer:
      "Starting something new is exciting — here's a clear, proven way to think about it.\n\n**1. Fall in love with a problem, not a solution.**\nThe best businesses solve a real, painful, frequent problem for a specific group of people. Describe the customer and the pain precisely.\n\n**2. Validate before you build.**\nTalk to ~20 potential customers. Ask about *how they cope today*, not whether they'd \"buy your idea.\" If they're not already paying for a workaround, the pain may be too small.\n\n**3. Build the smallest version (MVP).**\nShip the simplest thing that delivers the core value. Speed beats polish early on.\n\n**4. Measure and learn.**\nTrack real signals — sign-ups, usage, willingness to pay — not vanity metrics. Iterate fast.\n\n**5. Mind the fundamentals.**\nKeep costs low, keep enough runway (cash), and remember: most winners survive long enough to find what works.\n\nTell me your idea and I'll pressure-test it with you.",
  },
  {
    keys: ["sleep", "why do we sleep", "how to sleep better", "insomnia"],
    answer:
      "**Sleep** isn't downtime — it's when your brain and body do essential repair, memory, and cleanup work. Skip it and everything (focus, mood, immunity) suffers.\n\n**How to sleep better tonight**\n1. **Keep a consistent schedule** — same bedtime and wake time, even weekends. Your body clock loves rhythm.\n2. **Light in the morning, dark at night** — sunlight early sets your clock; dim screens 1–2 hours before bed.\n3. **Cool, dark, quiet room** — around 18°C (65°F) is ideal for most people.\n4. **Cut late stimulants** — caffeine has a long tail (avoid after early afternoon); limit alcohol (it fragments sleep).\n5. **Wind down** — a calm routine signals \"time to rest.\"\n\n**Quick facts**\nMost adults need **7–9 hours**. If you can't fall asleep after ~20 minutes, get up briefly rather than tossing — it protects the bed-sleep association.\n\nFor chronic insomnia, cognitive behavioral therapy (CBT-I) has the strongest evidence. Want a simple wind-down routine?",
  },
  {
    keys: ["nutrition", "healthy eating", "diet", "what should i eat", "macronutrients"],
    answer:
      "Good **nutrition** doesn't need to be complicated. Here are the principles that almost every expert agrees on.\n\n**The fundamentals**\n- **Eat mostly whole foods** — vegetables, fruits, legumes, whole grains, nuts, lean protein. The less processed, the better.\n- **Plants, lots of them** — variety and color give you fiber, vitamins, and phytonutrients.\n- **Protein at each meal** — keeps you full and supports muscle.\n- **Watch added sugar and ultra-processed foods** — the biggest modern dietary risk.\n- **Hydrate** — water first; many people mistake thirst for hunger.\n\n**The three macronutrients**\n- **Carbs** — your body's main fuel (prefer complex, fiber-rich ones).\n- **Protein** — building blocks for muscle and tissue.\n- **Fat** — essential for hormones and absorbing vitamins (favor unsaturated fats).\n\n**The honest truth**\nThe best diet is **the healthy one you can stick to**. Sustainability beats perfection. (And I'm not a doctor — for medical needs, see a professional.) Want a simple day of meals as a starting point?",
  },
  {
    keys: ["productivity", "time management", "procrastination", "focus", "how to be productive"],
    answer:
      "Real productivity isn't doing *more* — it's doing **what matters**. Here's what actually works.\n\n**Principles that pay off**\n1. **Do the important thing first.** Tackle your highest-value task before the day fills with interruptions (\"eat the frog\").\n2. **One thing at a time.** Multitasking feels fast but isn't — single-task and go deep.\n3. **Work in focused blocks.** Try 25–50 minutes of focus, then a short break (the Pomodoro idea).\n4. **Write everything down.** A trusted list frees your mind from juggling.\n5. **Say no.** Protecting attention is protecting output.\n\n**Beating procrastination**\nIt's usually an **emotion** problem (avoiding discomfort), not a time problem. The fix: shrink the task to a tiny first step (*\"just open the doc\"*) and start — momentum does the rest.\n\n**Energy matters too.** Sleep, movement, and breaks are productivity tools, not luxuries.\n\nWant a simple daily system you can start today?",
  },
  {
    keys: ["world war 2", "ww2", "second world war", "world war ii"],
    answer:
      "**World War II (1939–1945)** was the deadliest conflict in human history and reshaped the modern world.\n\n**How it started**\nAfter WWI and a punishing peace, economic crisis and aggressive expansionism fueled the rise of fascist regimes — Nazi Germany, Fascist Italy, and Imperial Japan. Germany's invasion of **Poland in September 1939** triggered Britain and France to declare war.\n\n**The two sides**\n- **Allies:** UK, USSR, US, China, France, and many others.\n- **Axis:** Germany, Italy, Japan.\n\n**Turning points**\n- **1941** — Germany invades the USSR; the US enters after Pearl Harbor. The war becomes truly global.\n- **1942–43** — Stalingrad, Midway, and El Alamein shift momentum to the Allies.\n- **1944** — D-Day opens the Western front.\n- **1945** — Germany surrenders (May); after atomic bombings, Japan surrenders (August).\n\n**Legacy:** the UN, the Cold War, decolonization, and a lasting commitment (however imperfect) to \"never again.\" Want to focus on a specific front or cause?",
  },
  {
    keys: ["solar system", "planets", "the sun", "how many planets"],
    answer:
      "Our **solar system** is the Sun and everything bound to it by gravity — eight planets, their moons, and countless smaller bodies.\n\n**The lineup (from the Sun outward)**\n1. **Mercury** — small, scorched, fast.\n2. **Venus** — roasting, thick toxic atmosphere.\n3. **Earth** — our Goldilocks world, with liquid water and life.\n4. **Mars** — cold, rusty, a top target for exploration.\n5. **Jupiter** — the giant; a swirling ball of gas with dozens of moons.\n6. **Saturn** — famous for its dazzling rings.\n7. **Uranus** — an ice giant tipped on its side.\n8. **Neptune** — windiest place we know, deep blue.\n\n**The key idea**\nThe **Sun** holds 99.8% of the system's mass, so its gravity dominates everything. The inner four are rocky (**terrestrial**); the outer four are gas/ice **giants**. Pluto is now classed as a **dwarf planet**.\n\nWant to go deeper — how it formed, or the search for life on Mars and the ocean moons?",
  },
  {
    keys: ["recursion", "recursive function", "recursion explained"],
    answer:
      "**Recursion** is when a function calls *itself* to solve a smaller version of the same problem.\n\nEvery recursive function needs two things:\n1. **A base case** — the simplest input, where you return an answer directly (this stops the calls).\n2. **A recursive case** — break the problem into a smaller piece, and call yourself on it.\n\n**Classic example — factorial:**\n```python\ndef factorial(n):\n    if n <= 1:          # base case\n        return 1\n    return n * factorial(n - 1)  # recursive case\n```\n`factorial(4)` → `4 * factorial(3)` → `4 * 3 * factorial(2)` → … → `24`.\n\n**The intuition:** trust that the smaller call does its job correctly, then combine the result. It's perfect for problems with a self-similar structure — trees, file systems, mazes, sorting (merge sort). Watch out for **stack overflow** if you forget the base case!\n\nWant a visual trace, or a recursion vs. loop comparison?",
  },
  {
    keys: ["object oriented", "oop", "classes and objects", "what is a class", "inheritance"],
    answer:
      "**Object-Oriented Programming (OOP)** organizes code around **objects** — bundles of related data and the actions that work on it.\n\n**The four pillars**\n1. **Encapsulation** — hide internal details; expose a clean interface (like a car: you use the pedals, not the engine internals).\n2. **Abstraction** — model only what matters; ignore the rest.\n3. **Inheritance** — a new class reuses and extends an existing one (`Dog` is an `Animal`).\n4. **Polymorphism** — different objects can respond to the same message in their own way (`.speak()` barks for a dog, meows for a cat).\n\n**A class is a blueprint; an object is a thing built from it.**\n```python\nclass Dog:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return f\"{self.name} says woof!\"\n\nrex = Dog(\"Rex\")\nprint(rex.speak())  # Rex says woof!\n```\n\nOOP shines for large programs with many interacting entities. Want to see inheritance in action?",
  },
  {
    keys: ["async", "await", "promise", "asynchronous", "callbacks", "concurrency"],
    answer:
      "**Asynchronous programming** lets a program keep doing useful work while it *waits* on something slow — like a network request, a file, or a timer — instead of freezing.\n\n**The problem it solves:** some operations take time. If the code waited (\"blocked\") for each one, the app would feel frozen. Async says: *\"start this, and run this callback when it's done.\"*\n\n**In modern JavaScript, the clean pattern is `async`/`await`:**\n```javascript\nasync function getUser(id) {\n  const res = await fetch(`/api/users/${id}`);  // wait here, non-blocking\n  const user = await res.json();\n  return user;  // this returns a Promise\n}\n```\n- `await` pauses *this function* until the promise resolves — but frees up the program to do other things meanwhile.\n- Wrap risky calls in `try/catch` to handle errors.\n\nA **Promise** is simply a value that will be available *in the future* (pending → fulfilled or rejected). Want a diagram of the flow, or to compare with callbacks?",
  },
  {
    keys: ["big o", "time complexity", "algorithm complexity", "o(n)", "big-o"],
    answer:
      "**Big O** describes how an algorithm's runtime (or memory) grows as the input size grows — ignoring constants and hardware, focusing on the **trend**.\n\n**Common classes (fast → slow)**\n- **O(1)** — constant. Same time regardless of input (lookup in a hash map).\n- **O(log n)** — logarithmic. Halves the work each step (binary search).\n- **O(n)** — linear. Scales with input (scanning a list once).\n- **O(n log n)** — efficient sorting (merge sort, quicksort).\n- **O(n²)** — quadratic. Nested loops over the input (bubble sort).\n- **O(2ⁿ)** — exponential. Grows explosively (naive recursion).\n\n**Why it matters:** it tells you whether your code will survive a bigger input. An O(n²) algorithm that's fine for 100 items can choke on 100,000.\n\n**The mindset:** count how the work *scales*, not exact milliseconds. Want a worked example comparing two solutions to the same problem?",
  },
  {
    keys: ["cloud computing", "the cloud", "aws", "what is cloud", "cloud hosting"],
    answer:
      "**Cloud computing** means renting computers and services over the internet instead of buying and running your own.\n\n**The analogy:** it's like electricity. You don't build a power plant — you plug in and pay for what you use. The cloud does the same for computing power and storage.\n\n**The three main models**\n- **IaaS** — rent raw machines/networks (e.g., AWS EC2, virtual servers).\n- **PaaS** — rent a ready platform to deploy apps (you bring code, they run it).\n- **SaaS** — rent finished software (Gmail, Google Docs, Slack).\n\n**Why teams love it**\n- **No upfront hardware costs** — pay as you go.\n- **Elastic** — scale up for traffic spikes, down when quiet.\n- **Less ops work** — the provider handles security patches, redundancy, backups.\n\nThe trade-off: ongoing costs, vendor lock-in, and reliance on someone else's infrastructure. Major providers include AWS, Google Cloud, and Microsoft Azure.",
  },
  {
    keys: ["data structures", "arrays", "linked list", "hash map", "stack", "queue"],
    answer:
      "**Data structures** are organized ways to store data so you can use it efficiently. Picking the right one is often the difference between fast and slow code.\n\n**The classics**\n- **Array / List** — items in a row; fast by index, slow to insert in the middle.\n- **Hash map (dictionary)** — key → value; blazing-fast lookups (≈O(1)).\n- **Linked list** — chained nodes; easy inserts/deletes, slow random access.\n- **Stack** — last-in, first-out (like a pile of plates).\n- **Queue** — first-in, first-out (like a line at a counter).\n- **Tree / Graph** — for hierarchical or networked relationships.\n\n**The golden rule:** match the structure to the *operations* you do most. Need fast lookups by name? Hash map. Need order plus inserts anywhere? Linked list. Processing in order? Queue.\n\nWant a concrete example where the wrong choice makes code 1000× slower?",
  },
  {
    keys: ["operating system", "what is an os", "windows", "linux", "macos"],
    answer:
      "An **operating system (OS)** is the core software that manages a computer's hardware and lets programs run — it's the bridge between you (and your apps) and the machine.\n\n**What it actually does**\n- Manages the **CPU**, memory, storage, and devices.\n- Runs and schedules **processes** (who gets the CPU, and when).\n- Provides a **file system** to organize data.\n- Offers a set of services apps use (windows, networking, security).\n\n**Familiar examples:** Windows, macOS, and Linux on computers; iOS and Android on phones. Linux is open-source and powers most servers and the internet's infrastructure.\n\n**Why it matters:** without an OS, every app would have to know how to talk to every piece of hardware — chaotic. The OS standardizes all that so apps can be written once and run anywhere.",
  },
  {
    keys: ["habits", "building habits", "how to build habits", "atomic habits", "habit formation"],
    answer:
      "**Habits** are behaviors your brain automates so it doesn't have to re-decide them every time — and you can deliberately design them.\n\n**The habit loop**\n1. **Cue** — the trigger that starts it (a time, place, or feeling).\n2. **Routine** — the behavior itself.\n3. **Reward** — the payoff that makes your brain want to repeat it.\n\nChange a habit by tweaking any link: attach a new habit to an existing cue (*\"after I pour my coffee, I'll write one sentence\"*), make the routine tiny and easy to start, and give yourself an immediate reward.\n\n**What actually works**\n- **Make it small.** Two minutes is enough to build the identity of \"someone who does this.\"\n- **Reduce friction** for good habits, **increase it** for bad ones.\n- **Stack habits** onto existing routines.\n- **Never miss twice.** One slip is an accident; two is the start of a new habit.\n\nConsistency beats intensity — showing up small, every day, compounds.",
  },
  {
    keys: ["motivation", "stay motivated", "discipline", "procrastinate", "how to stay motivated"],
    answer:
      "Here's the honest truth about **motivation**: it's unreliable — it comes and goes. **Discipline** (and good systems) is what carries you when motivation doesn't show up.\n\n**Why we procrastinate**\nIt's rarely laziness — it's usually an **emotion** problem. We avoid tasks that feel overwhelming, boring, scary, or ambiguous. The fix isn't more willpower; it's making the task less uncomfortable.\n\n**What works**\n1. **Shrink the first step** until it feels almost too easy (*\"just open the document\"*). Starting creates momentum.\n2. **Make it specific.** \"Study at 7pm at the desk\" beats \"study more.\"\n3. **Remove friction.** Put your phone away; lay out what you need in advance.\n4. **Use the 2-minute rule** — if it takes under two minutes, do it now.\n5. **Pair it with something pleasant** (music, a nice drink).\n\nMotivation often *follows* action, not the other way around — start small, and the desire to keep going usually shows up.",
  },
  {
    keys: ["public speaking", "presentation", "how to give a speech", "stage fright", "speaking"],
    answer:
      "**Public speaking** gets easier with a repeatable structure and a few reliable techniques.\n\n**Structure first**\n- **Hook** — start with a question, story, or surprising fact.\n- **Three points** — the human brain remembers threes. One core message, supported by three ideas.\n- **Close strong** — end with a clear takeaway or call to action, then stop.\n\n**Calm the nerves**\n- **Prepare more than you think you need**, then rehearse out loud. Confidence comes from familiarity.\n- **Breathe slowly** before you start; it lowers your heart rate.\n- **Know your first sentence cold** — the rest flows once you've begun.\n- **Pause.** Silence feels long to you but natural to the audience, and it makes you sound authoritative.\n\n**Connect with the audience**\n- Make eye contact with friendly faces across the room.\n- Speak a little slower than feels natural.\n- Tell stories, not just facts — people remember stories.\n\nNerves are normal; even pros feel them. They just don't show it.",
  },
  {
    keys: ["investing", "compound interest", "stocks", "how to invest", "investments", "index fund"],
    answer:
      "**Investing** is putting your money to work so it grows over time, instead of losing value to inflation in a savings account.\n\n**The single most powerful idea: compound interest**\nWhen your money earns returns, and those returns earn returns, growth snowballs. The earlier you start, the more dramatic the effect — time matters more than timing.\n\n**A simple, sensible approach for most people**\n1. **Build an emergency fund first** (3–6 months of expenses in cash).\n2. **Pay off high-interest debt** — that's a guaranteed high return.\n3. **Use low-cost index funds** — they buy a slice of the whole market, giving diversification and low fees without picking individual stocks.\n4. **Invest regularly** (every month) and **leave it alone** — don't try to time the market.\n5. **Diversify** and match your risk to your timeline.\n\n**Golden rules:** start early, keep fees low, think in years not days, and never invest money you'll need soon. (This is general education, not personalized financial advice.)",
  },
  {
    keys: ["meditation", "mindfulness", "how to meditate", "calm", "anxiety relief"],
    answer:
      "**Meditation** is simply training your attention — usually by focusing on your breath and gently returning when your mind wanders. It's a skill, not a mystical state.\n\n**A 5-minute beginner practice**\n1. Sit comfortably, back upright but relaxed.\n2. Close your eyes and notice your breath — the rise and fall of your chest or the air at your nostrils.\n3. When your mind wanders (it will, a lot), **notice it without judgment** and return to the breath.\n4. That's it. The *returning* is the exercise.\n\n**What it's not**\n- It's not about \"emptying your mind\" — that's impossible. It's about noticing where your attention goes.\n- It's not a quick fix. Like exercise, the benefits build with consistency.\n\n**Why people stick with it**\nRegular practice is linked to less reactivity to stress, better focus, and more emotional balance. Even a few minutes a day helps. The hardest part is sitting down — start there.",
  },
  {
    keys: ["writing tips", "how to write better", "better writing", "writing skills", "improve writing"],
    answer:
      "Good **writing** is mostly good *thinking* and ruthless editing. Here's what separates clear writing from muddy writing.\n\n**Principles that always help**\n1. **Know your one main point.** If you can't state it in a sentence, the reader won't find it.\n2. **Write for a reader who's busy.** Get to the point; cut everything that doesn't serve it.\n3. **Prefer simple words.** \"Use\" beats \"utilize.\" Clarity beats cleverness.\n4. **Short sentences, then vary them.** Short carries punch. Occasional longer ones add rhythm.\n5. **Active voice.** \"The team launched the app\" beats \"the app was launched.\"\n6. **Read it out loud.** Anything that trips your tongue will trip the reader.\n\n**The writing process**\n- **Draft fast** — get ideas down without judging.\n- **Edit slowly** — that's where good writing is actually made.\n- **Cut, then cut again.** Your first draft is too long; the good stuff is underneath.\n\nThe best writers aren't the most talented — they're the most willing to revise.",
  },
  {
    keys: ["learn a language", "language learning", "learn a new language", "fluency"],
    answer:
      "Here's the most effective way to **learn a language** — backed by how our brains actually acquire them.\n\n**The core principle: comprehensible input**\nYou learn fastest from messages you *mostly* understand — slightly above your level, in large quantities. Reading and listening to real content beats grinding grammar drills.\n\n**A practical routine**\n1. **Daily, not marathon.** 20 minutes every day crushes 3 hours once a week. Consistency builds the habit loop.\n2. **Start with high-frequency words.** The 1,000 most common words cover most everyday conversation.\n3. **Get comprehensible input** — graded readers, podcasts for learners, kids' shows with subtitles.\n4. **Speak from day one**, even badly — language is a skill you build by using it.\n5. **Use spaced repetition** (like flashcards) for vocabulary.\n\n**Mindset**\nEmbrace mistakes — they're how you learn, not signs of failure. Aim for *understanding and being understood*, not perfection. Fluency comes from hours of exposure, so make it enjoyable enough to keep showing up.",
  },
  {
    keys: ["stress", "anxiety", "manage stress", "overwhelmed", "cope with anxiety"],
    answer:
      "**Stress and anxiety** are normal human responses — your body's alarm system. The goal isn't to eliminate them, but to manage how they affect you.\n\n**Quick tools that actually calm the nervous system**\n1. **Slow breathing** — inhale 4 seconds, hold, exhale 6–8. Longer exhales signal safety to your body.\n2. **The 5-4-3-2-2 ground** — name 5 things you see, 4 you hear, 3 you can touch. It pulls you out of spiraling thoughts.\n3. **Move your body** — a short walk burns off the stress chemicals.\n4. **Brain-dump** — write down everything worrying you to get it out of your head.\n\n**For the bigger picture**\n- **Sleep, movement, and limiting caffeine/alcohol** are foundational.\n- **Limit doomscrolling** — constant bad news keeps the alarm on.\n- **Talk to someone** — connection is one of the strongest stress buffers.\n\nIf anxiety is persistent, intense, or interfering with daily life, that's exactly what therapists and doctors are there for — reaching out is a strength, not a weakness. (I'm an AI, not a professional — for real support, please talk to one.)",
  },
  {
    keys: ["goal setting", "how to set goals", "achieve goals", "smart goals"],
    answer:
      "**Goal setting** works — but only when goals are clear and backed by a plan. Here's the version that consistently gets results.\n\n**Make goals SMART**\n- **Specific** — \"run a 5k\" beats \"get fit.\"\n- **Measurable** — you need to know when you've arrived.\n- **Achievable** — ambitious but realistic, given your life.\n- **Relevant** — it should matter to *you*, not just sound impressive.\n- **Time-bound** — a deadline creates focus.\n\n**Then bridge the gap**\n1. **Work backward** from the goal to this week's task.\n2. **Focus on the system, not just the goal.** You don't rise to your goals; you fall to your systems. Want to write a book? Build the system of writing daily.\n3. **Track progress** — visible progress is wildly motivating.\n4. **Plan for obstacles** — decide in advance what you'll do when motivation dips.\n5. **Review and adjust** weekly.\n\nOutcome goals give direction; process goals get you there. Show up for the process, and the outcome tends to follow.",
  },
  {
    keys: ["critical thinking", "logical fallacies", "how to think", "mental models", "reasoning"],
    answer:
      "**Critical thinking** is the habit of evaluating claims and decisions carefully — questioning assumptions, weighing evidence, and noticing when something doesn't add up.\n\n**Core habits**\n1. **Question the source.** Who benefits from you believing this? Is the evidence solid or just confident?\n2. **Separate fact from opinion.** Both can be useful, but they're not the same.\n3. **Watch for bias** — yours included. We notice evidence that confirms what we already believe (confirmation bias).\n4. **Consider the opposite.** What would change your mind? If nothing could, that's a warning sign.\n\n**Common logical fallacies to spot**\n- **Ad hominem** — attacking the person, not the argument.\n- **Strawman** — distorting someone's point to knock it down.\n- **False dichotomy** — pretending there are only two options.\n- **Appeal to authority** — \"X is right because an expert said so,\" without evidence.\n\n**Mental models** (like inversion — \"what would guarantee failure?\" — and second-order thinking — \"and then what?\") are reusable tools for clearer reasoning. Curiosity plus healthy skepticism is the sweet spot.",
  },
  {
    keys: ["interview", "job interview", "interview tips", "how to interview"],
    answer:
      "Acing a **job interview** comes down to preparation, clear communication, and genuine curiosity.\n\n**Before**\n- **Research the role and company** — their product, values, recent news. Reference specifics to show you care.\n- **Prepare your stories.** Most questions map to a few themes: a challenge you solved, a conflict, a failure you learned from, a leadership moment. Shape them with the **STAR** method: **S**ituation, **T**ask, **A**ction, **R**esult.\n- **Rehearse out loud** — thinking it isn't the same as saying it.\n\n**During**\n- **Listen fully**, then answer the question asked — concisely, with a concrete example.\n- **Quantify your impact** — numbers make achievements memorable.\n- **Be honest** about gaps; spin isn't as smooth as you think.\n- **Ask good questions** — about the team, challenges, how success is measured. It signals engagement and helps *you* decide.\n\n**Mindset**\nAn interview is a two-way conversation, not an interrogation. Be yourself — you want a job that fits the real you. Send a brief thank-you note after; it's a small touch that few bother with.",
  },
  {
    keys: ["leadership", "how to be a leader", "good leader", "management"],
    answer:
      "Good **leadership** isn't about authority — it's about helping a group of people achieve something together. The best leaders are made through deliberate practice, not born.\n\n**What strong leaders actually do**\n1. **Set a clear direction.** People do their best work when they understand the *why* and where they're headed.\n2. **Communicate constantly and honestly.** Over-communicate context, share the good and the bad, and listen more than you speak.\n3. **Build trust.** Do what you say, give credit, take blame, and have people's backs.\n4. **Develop your people.** A leader's job is to make more leaders — coach, delegate, and create space for others to grow.\n5. **Make decisions and own them.** Decisiveness, even imperfect, beats endless indecision.\n\n**The shift in mindset**\nMoving from individual contributor to leader means your success is no longer about *your* output — it's about the team's. You go from doing the work to enabling the work: removing obstacles, clarifying priorities, and creating an environment where people can do their best.\n\nGreat leaders are also humble — they ask questions, admit mistakes, and keep learning.",
  },
  {
    keys: ["communication skills", "how to communicate", "better communicator", "listening"],
    answer:
      "**Communication** is the skill that amplifies every other skill — and like any skill, it improves with deliberate practice.\n\n**Listen first**\nThe biggest unlock is genuine listening. Most people listen to reply, not to understand. Try reflecting back what you heard (*\"so what you're saying is…\"*) — it makes people feel heard and prevents misunderstandings.\n\n**Be clear and concise**\n- **Lead with the point**, then the supporting detail (the \"BLUF\" — bottom line up front).\n- **Know your audience** and adjust — what does *this* person need to hear?\n- **Avoid filler and jargon.** Simple, concrete language lands hardest.\n\n**Handle hard conversations well**\n- **Assume good intent** until proven otherwise.\n- **Talk about behavior and impact**, not character (*\"when X happened, I felt Y\"* beats *\"you always…\"*).\n- **Curious over confrontational** — ask questions before making accusations.\n\n**Watch the non-verbals**\nTone, eye contact, and body language often carry more than the words. Match your tone to your message, and notice others'. Communication is two skills: expressing yourself clearly *and* making space for others to do the same.",
  },
  {
    keys: ["negotiation", "how to negotiate", "salary negotiation", "negotiate"],
    answer:
      "**Negotiation** isn't about winning at someone's expense — it's about finding the best mutual outcome. The best negotiators are collaborative, not combative.\n\n**Before you negotiate**\n- **Know your walk-away point** — the minimum you'd accept. Decide this calmly, in advance.\n- **Understand their interests**, not just their stated position. *Why* do they want what they want?\n- **Prepare your value** — for a salary, that's market data and concrete impact you've had.\n\n**During**\n1. **Anchor with information, not demands.** Ask questions; the side with more information usually does better.\n2. **Don't accept the first offer too fast** — it makes the other side feel they left money on the table.\n3. **Expand the pie** — if you're stuck on price, trade across other terms (timing, scope, perks, flexibility).\n4. **Make it easy for them to say yes** — frame your ask so it also serves their interests.\n\n**Mindset**\nAim for a deal where *both* sides feel good — that's how you protect relationships and reputation. Silence is powerful: after making an offer, stop talking and let them respond. And it's fine to walk away when the terms don't work for you.",
  },
];

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "in", "on",
  "for", "and", "or", "what", "how", "why", "who", "when", "do", "does", "did",
  "can", "could", "would", "should", "tell", "me", "about", "you", "i", "we",
  "it", "this", "that", "with", "as", "at", "by", "from", "please", "explain",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Score an entry against the prompt. Phrase keys count more. */
function scoreEntry(entry: KBEntry, prompt: string, promptWords: Set<string>): number {
  let score = 0;
  for (const key of entry.keys) {
    const k = key.toLowerCase();
    if (k.includes(" ")) {
      if (prompt.includes(k)) score += 5; // multi-word phrase = strong signal
    } else if (promptWords.has(k)) {
      score += 3; // exact whole-word topic match
    } else if (prompt.includes(k)) {
      score += 1; // substring only (weak)
    }
  }
  return score;
}

/** Return the best-matching entry, or null if nothing is relevant enough. */
export function lookup(prompt: string): { entry: KBEntry; score: number } | null {
  const p = prompt.toLowerCase();
  const pw = new Set(words(prompt));
  let best: KBEntry | null = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    const s = scoreEntry(entry, p, pw);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  // Require a meaningful match: a phrase hit or a solid whole-word topic match.
  if (best && bestScore >= 3) return { entry: best, score: bestScore };
  return null;
}
