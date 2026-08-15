"use client";

import { useState } from "react";
import { buildAnything } from "../lib/builder";
import { cn } from "../utils/cn";

interface Props {
  onOpenSidebar?: () => void;
}

const DEFAULT_HTML = `<!doctype html>
<html>
<body style="font-family:system-ui;padding:2rem;background:#faf9f5">
  <h1 style="color:#d97757">Hello from Nexora Workspace 👋</h1>
  <p>Describe what you want to build in the prompt above, or edit the code below.</p>
</body>
</html>`;

const DEFAULT_JS = `// JavaScript sandbox
function greet(name) {
  return "Hello, " + name + "!";
}
console.log(greet("Nexora"));
`;

export function WorkspaceView({ onOpenSidebar }: Props) {
  const [prompt, setPrompt] = useState("");
  const [lang, setLang] = useState<"html" | "js">("html");
  const [code, setCode] = useState(DEFAULT_HTML);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const generate = () => {
    const t = prompt.trim();
    if (!t) return;
    setError("");
    try {
      const app = buildAnything(t);
      setLang("html");
      setCode(app.html);
      setOutput("");
    } catch (e: any) {
      setError(e.message || "Could not generate");
    }
  };

  const run = async () => {
    setError("");
    setOutput("");
    if (lang === "html") {
      // Live preview handled by iframe; just refresh output note
      setOutput("Preview is on the right →");
      return;
    }
    setRunning(true);
    setOutput("Running...");
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Execution failed");
        setOutput((data.logs || []).join("\n"));
      } else {
        setOutput([...(data.logs || []), data.result ? `→ ${data.result}` : ""].join("\n"));
      }
    } catch (e: any) {
      setError(e.message || "Execution failed");
    }
    setRunning(false);
  };

  return (
    <div className="flex h-full flex-col bg-cream dark:bg-night">
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <button
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream-deep lg:hidden dark:text-cream"
        >
          ☰
        </button>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-ink dark:text-cream">Vibe Coding Workspace</div>
          <div className="text-[11px] text-muted">Generate, edit & preview — build with AI</div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            running ? "bg-cream-deep text-muted-2" : "bg-coral text-white hover:bg-coral-hover"
          )}
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </header>

      {/* AI prompt bar */}
      <div className="flex items-end gap-2 px-3 pb-2 sm:px-5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
          placeholder='Ask AI: "make a todo app", "build a calculator", "cafe website"...'
          className="flex-1 rounded-xl border border-line bg-cream-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
        />
        <button
          onClick={generate}
          disabled={!prompt.trim()}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            prompt.trim() ? "bg-ink text-cream hover:opacity-90 dark:bg-cream dark:text-ink" : "bg-cream-deep text-muted-2 dark:bg-night-surface"
          )}
        >
          ✨ Generate
        </button>
      </div>

      {/* Lang toggle */}
      <div className="flex items-center gap-1 px-3 pb-2 sm:px-5">
        {(["html", "js"] as const).map((l) => (
          <button
            key={l}
            onClick={() => { setLang(l); setOutput(""); }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              lang === l ? "bg-coral text-white" : "bg-cream-deep text-muted hover:text-ink-soft dark:bg-night-surface dark:text-cream/70"
            )}
          >
            {l === "html" ? "HTML · Preview" : "JavaScript · Console"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-2">{lang === "html" ? "Edits preview live →" : "console.log output ↓"}</span>
      </div>

      {error && <div className="px-3 pb-1 text-xs text-red-500 sm:px-5">{error}</div>}

      {/* Body */}
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden px-3 pb-3 md:grid-cols-2 sm:px-5">
        {/* Code editor */}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none rounded-xl border border-line bg-[#1a1a24] p-4 font-mono text-[13px] leading-relaxed text-cream focus:border-coral focus:outline-none dark:bg-[#0d0d12]"
        />
        {/* Preview / Output */}
        {lang === "html" ? (
          <iframe
            title="preview"
            srcDoc={code}
            sandbox="allow-scripts"
            className="h-full w-full rounded-xl border border-line bg-white dark:border-night-surface"
          />
        ) : (
          <div className="overflow-auto rounded-xl border border-line bg-[#1a1a24] p-4 font-mono text-[13px] text-cream/90 dark:bg-[#0d0d12]">
            {output || <span className="text-cream/40">Run your code to see console output...</span>}
          </div>
        )}
      </div>
    </div>
  );
}
