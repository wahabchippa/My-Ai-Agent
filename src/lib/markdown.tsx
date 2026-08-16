import { useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "../components/icons";
import { cn } from "../utils/cn";

/**
 * A small, dependency-free Markdown renderer tuned for chat answers.
 * Supports: code fences, tables, headings, lists, blockquotes, hr,
 * bold, italic, inline code, and links.
 */

/* ----------------------------- inline parsing ---------------------------- */

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize while preserving delimiters: `code`, **bold**, *italic*, [text](url)
  // ![alt](url) link se PEHLE match hona chahiye, warna "[" wala branch
  // usay aam link samajh kar image kabhi render na kare.
  const regex = /(!\[[^\]]*\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const tok = match[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("![")) {
      // Pehle markdown me image ka koi support tha hi nahi — model
      // ![chart](url) bhejta to user ko raw text dikhta tha. Ab asal
      // tasveer banti hai.
      const m = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) {
        const src = m[2].trim();
        // data: aur http(s) ke ilawa kuch bhi render karna khatarnak hai.
        const safe = /^(https?:\/\/|data:image\/)/i.test(src);
        nodes.push(
          safe ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={src}
              alt={m[1] || "image"}
              loading="lazy"
              className="my-3 max-h-[420px] w-auto max-w-full rounded-xl border border-line object-contain dark:border-night-surface"
            />
          ) : (
            <span key={key} className="text-muted">
              [image: {m[1] || src}]
            </span>
          )
        );
      }
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-[5px] bg-cream-deep px-1.5 py-0.5 font-mono text-[0.85em] text-coral-hover dark:bg-night-surface"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink dark:text-cream">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("[")) {
      const m = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (m) {
        nodes.push(
          <a
            key={key}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-coral-hover underline decoration-coral-hover/40 underline-offset-2 hover:decoration-coral-hover"
          >
            {m[1]}
          </a>
        );
      }
    } else if (tok.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + tok.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/* -------------------------------- code block ------------------------------ */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  // SVG (logo, chart, diagram) sirf code ke tor par dikhana bekaar hai —
  // user ne tasveer maangi thi, text nahi. Ab dono milte hain: bani hui
  // tasveer, aur neeche uska code (khol kar dekh/copy kar sakte hain).
  const isSvg =
    (lang ?? "").toLowerCase() === "svg" ||
    (/^\s*<svg[\s>]/i.test(code) && /<\/svg>\s*$/i.test(code.trim()));
  const [showCode, setShowCode] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <div className="group/code my-3 overflow-hidden rounded-xl border border-line bg-[#1d1d1b] text-[13px] dark:border-night-surface">
      {isSvg && (
        <div className="flex flex-col items-center gap-2 border-b border-white/10 bg-[repeating-conic-gradient(#f7f6f3_0_25%,#ffffff_0_50%)] bg-[length:16px_16px] p-4">
          <div
            className="flex max-h-[320px] w-full items-center justify-center overflow-hidden [&>svg]:max-h-[300px] [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: code }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const blob = new Blob([code], { type: "image/svg+xml" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "nexora-image.svg";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="rounded-md bg-black/5 px-2 py-1 text-[11px] font-medium text-black/60 transition hover:bg-black/10"
            >
              ↓ .svg
            </button>
            <button
              onClick={() => setShowCode((v) => !v)}
              className="rounded-md bg-black/5 px-2 py-1 text-[11px] font-medium text-black/60 transition hover:bg-black/10"
            >
              {showCode ? "hide code" : "show code"}
            </button>
          </div>
        </div>
      )}
      <div className={cn("flex items-center justify-between border-b border-white/10 px-4 py-2", isSvg && !showCode && "hidden")}>
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/45">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {(!isSvg || showCode) && (
        <pre className="overflow-x-auto p-4 leading-relaxed">
          <code className="font-mono text-[#e8e6e0]">{code}</code>
        </pre>
      )}
    </div>
  );
}

/* --------------------------------- table ---------------------------------- */

function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-line dark:border-night-surface">
      <table className="w-full border-collapse text-sm">
        {header && (
          <thead>
            <tr className="bg-cream-deep dark:bg-night-surface">
              {header.map((c, i) => (
                <th
                  key={i}
                  className="border-b border-line px-3 py-2 text-left font-semibold dark:border-night-surface"
                >
                  {renderInline(c, `th${i}`)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="odd:bg-cream/40 dark:odd:bg-night/40">
              {row.map((c, ci) => (
                <td
                  key={ci}
                  className="border-b border-line/60 px-3 py-2 align-top dark:border-night-surface/60"
                >
                  {renderInline(c, `td${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- main parser ------------------------------ */

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(<CodeBlock key={key++} code={buf.join("\n")} lang={lang} />);
      continue;
    }

    // standalone image: ![alt](url)
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      blocks.push(
        <img
          key={key++}
          src={img[2]}
          alt={img[1]}
          loading="lazy"
          className="my-3 max-w-full rounded-xl border border-line dark:border-night-surface"
        />
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*([-*])\1{2,}\s*$/.test(line)) {
      blocks.push(
        <hr key={key++} className="my-4 border-line dark:border-night-surface" />
      );
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `h${key}`);
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base"][level - 1];
      blocks.push(
        <p key={key++} className={`mt-4 mb-2 font-semibold ${sizes} text-ink dark:text-cream`}>
          {content}
        </p>
      );
      i++;
      continue;
    }

    // table
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((_, idx) => idx !== 1) // drop the separator row
        .map((l) =>
          l
            .replace(/^\s*\|/, "")
            .replace(/\|\s*$/, "")
            .split("|")
            .map((c) => c.trim())
        );
      blocks.push(<Table key={key++} rows={rows} />);
      continue;
    }

    // blockquote
    if (line.trimStart().startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-[3px] border-coral/60 bg-coral-soft/40 py-1.5 pl-4 pr-3 text-ink-soft dark:bg-coral/10"
        >
          {renderInline(buf.join(" "), `bq${key}`)}
        </blockquote>
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 space-y-1.5 pl-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2.5 leading-relaxed">
              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-coral/70" />
              <span>{renderInline(it, `li${key}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 space-y-1.5 pl-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2.5 leading-relaxed">
              <span className="mt-px shrink-0 font-mono text-[0.78em] font-semibold text-coral">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span>{renderInline(it, `ol${key}-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph (merge consecutive non-empty, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !/^\s*([-*])\1{2,}\s*$/.test(lines[i]) &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith(">") &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 leading-[1.7] first:mt-0 last:mb-0">
        {renderInline(para.join(" "), `p${key}`)}
      </p>
    );
  }

  return <div className="text-[15px] text-ink-soft dark:text-cream/85">{blocks}</div>;
}
