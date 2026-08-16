// ═══════════════════════════════════════════════════════════════════
// NEXORA — URL / GITHUB READER
//
// MASLA JO YE HAL KARTA HAI:
//   User ne kaha "ye github repo check karo <link>" aur agent bola
//   "main web search nahi kar sakta".
//
//   Do alag wajah thin:
//     1. needsResearch() ek keyword regex hai (latest|news|price|...).
//        URL me ye lafz nahi hote, to research CHALTA HI NAHI tha.
//     2. research() sirf SEARCH karta hai — kisi diye hue URL ko
//        KHOL kar parhne ka koi raasta tha hi nahi.
//
//   Ab: koi bhi URL nazar aate hi wo asal me fetch kar ke parha jata hai,
//   aur GitHub links ke liye API se poora structured data aata hai.
// ═══════════════════════════════════════════════════════════════════

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<null>((res) => setTimeout(() => res(null), ms)),
    ]);
  } catch {
    return null;
  }
}

// ── URL nikalna ────────────────────────────────────────────────────

/**
 * Text me se URLs nikalo.
 * "github.com/foo/bar" (bina https ke) bhi pakarta hai — log aksar
 * aise hi likhte hain.
 */
export function extractUrls(text: string): string[] {
  const out = new Set<string>();

  // poore URLs
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gi)) {
    out.add(m[0].replace(/[.,;:!?]+$/, "")); // trailing viraam hata do
  }

  // bina scheme ke jaane-pehchane hosts
  for (const m of text.matchAll(
    /\b((?:github\.com|gitlab\.com|npmjs\.com|stackoverflow\.com|[a-z0-9-]+\.(?:com|org|net|io|dev|ai|app))\/[^\s<>"'`)\]}]+)/gi,
  )) {
    const clean = m[1].replace(/[.,;:!?]+$/, "");
    if (![...out].some((u) => u.includes(clean))) out.add(`https://${clean}`);
  }

  return [...out].slice(0, 3); // 3 se zyada nahi — waqt ka budget hai
}

/** Kya is message me koi URL hai? */
export function hasUrl(text: string): boolean {
  return extractUrls(text).length > 0;
}

// ── GitHub ─────────────────────────────────────────────────────────

const GH_RE =
  /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/|$|[?#])/i;

async function ghJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/vnd.github+json",
        // token ho to rate limit 60/hr se 5000/hr ho jati hai
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * GitHub repo ko asal me parho — metadata + README + file tree + languages.
 * Ye plain HTML scrape se kaafi behtar hai: structured aur mukammal.
 */
export async function readGitHubRepo(url: string): Promise<string> {
  const m = url.match(GH_RE);
  if (!m) return "";
  const [, owner, repo] = m;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const [meta, langs, tree] = await Promise.all([
    withTimeout(ghJson(base), 8000),
    withTimeout(ghJson(`${base}/languages`), 6000),
    withTimeout(ghJson(`${base}/contents`), 7000),
  ]);

  if (!meta) {
    // 404 = private ya mojood nahi. Ye batana zaroori hai warna model
    // andaza laga kar jhoot bol dega.
    return `GITHUB REPO: ${owner}/${repo}\nSTATUS: Nahi khul saka — repo private hai ya mojood nahi. Is ke baare me andaza mat lagao.`;
  }

  const lines: string[] = [];
  lines.push(`GITHUB REPO: ${meta.full_name}`);
  if (meta.description) lines.push(`DESCRIPTION: ${meta.description}`);
  lines.push(
    `STATS: ${meta.stargazers_count} stars · ${meta.forks_count} forks · ${meta.open_issues_count} open issues`,
  );
  lines.push(
    `MAIN LANGUAGE: ${meta.language ?? "n/a"} · LICENSE: ${meta.license?.spdx_id ?? "none"}`,
  );
  lines.push(
    `UPDATED: ${String(meta.pushed_at ?? "").slice(0, 10)} · CREATED: ${String(meta.created_at ?? "").slice(0, 10)}`,
  );
  if (meta.homepage) lines.push(`HOMEPAGE: ${meta.homepage}`);
  if (meta.topics?.length) lines.push(`TOPICS: ${meta.topics.join(", ")}`);
  if (meta.archived) lines.push(`⚠ ARCHIVED (ab maintain nahi hota)`);

  if (langs && typeof langs === "object") {
    const total = Object.values(langs).reduce((a: number, b: any) => a + b, 0);
    if (total > 0) {
      const pct = Object.entries(langs)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]: any) => `${k} ${((v / total) * 100).toFixed(0)}%`);
      lines.push(`LANGUAGES: ${pct.join(", ")}`);
    }
  }

  if (Array.isArray(tree)) {
    const files = tree
      .filter((f: any) => f.type === "file")
      .map((f: any) => f.name)
      .slice(0, 30);
    const dirs = tree
      .filter((f: any) => f.type === "dir")
      .map((f: any) => `${f.name}/`)
      .slice(0, 20);
    if (dirs.length) lines.push(`TOP-LEVEL DIRS: ${dirs.join(" ")}`);
    if (files.length) lines.push(`TOP-LEVEL FILES: ${files.join(" ")}`);
  }

  // README — asal maloomat yahin hoti hai
  const readme = await withTimeout(
    (async () => {
      const r = await fetch(`${base}/readme`, {
        headers: {
          "User-Agent": UA,
          Accept: "application/vnd.github.raw",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        cache: "no-store",
      });
      return r.ok ? await r.text() : "";
    })(),
    8000,
  );

  if (readme) {
    const clean = readme
      .replace(/<!--[\s\S]*?-->/g, "")          // HTML comments
      .replace(/^\[!\[.*$/gm, "")                // badge lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 6000);
    lines.push(`\nREADME:\n${clean}`);
  }

  return lines.join("\n");
}

// ── Aam web page ───────────────────────────────────────────────────

/** HTML se saaf text nikalo. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Koi bhi URL khol kar parho.
 * Do tareeqe azmate hain: pehle seedha fetch, phir r.jina.ai (jo JS-heavy
 * pages ko render kar deta hai). Ek nakaam ho to doosra chalta hai.
 */
export async function readUrl(url: string): Promise<string> {
  // GitHub ke liye API behtar hai
  if (GH_RE.test(url)) {
    const gh = await readGitHubRepo(url);
    if (gh) return gh;
  }

  // 1) seedha
  const direct = await withTimeout(
    (async () => {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        cache: "no-store",
        redirect: "follow",
      });
      if (!r.ok) return "";
      const ct = r.headers.get("content-type") ?? "";
      const body = await r.text();
      if (ct.includes("json")) return body.slice(0, 8000);
      return htmlToText(body);
    })(),
    9000,
  );

  if (direct && direct.length > 400) {
    return `PAGE: ${url}\n\n${direct.slice(0, 8000)}`;
  }

  // 2) jina reader — JS-render karta hai, aksar wahan chalta hai jahan
  //    seedha fetch khali ya blocked aata hai
  const jina = await withTimeout(
    (async () => {
      const r = await fetch(`https://r.jina.ai/${url}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return r.ok ? await r.text() : "";
    })(),
    12000,
  );

  if (jina && jina.trim().length > 200) {
    return `PAGE: ${url}\n\n${jina.slice(0, 8000)}`;
  }

  // Dono nakaam — ye SAAF batao. Warna model page ka mazmoon ghaR lega.
  if (direct) return `PAGE: ${url}\n\n${direct.slice(0, 8000)}`;
  return `PAGE: ${url}\nSTATUS: Ye page nahi khul saka. Is ke mazmoon ke baare me andaza mat lagao — user ko bata do ke link nahi khula.`;
}

/**
 * Message me maujood saare URLs parho (parallel).
 * Agent/chat routes isay seedha bula sakte hain.
 */
export async function readUrlsIn(text: string): Promise<string> {
  const urls = extractUrls(text);
  if (!urls.length) return "";

  const results = await Promise.all(urls.map((u) => readUrl(u).catch(() => "")));
  const good = results.filter((r) => r && r.trim());
  if (!good.length) return "";

  const stamp = new Date().toISOString().slice(0, 10);
  return `(fetched ${stamp})\n\n${good.join("\n\n---\n\n")}`;
}
