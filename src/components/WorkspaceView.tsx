"use client";

import { useState } from "react";
import { cn } from "../utils/cn";

interface Props {
  onOpenSidebar?: () => void;
}

export function WorkspaceView({ onOpenSidebar }: Props) {
  const [code, setCode] = useState(`// Try some JavaScript
function greet(name) {
  return "Hello, " + name + "!";
}
console.log(greet("Nexora"));
`);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setRunning(true);
    setError("");
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
          <div className="text-[15px] font-semibold text-ink dark:text-cream">Coding Workspace</div>
          <div className="text-[11px] text-muted">Write & run JavaScript in a safe sandbox</div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className={cn(
            "rounded-xl px-5 py-2 text-sm font-semibold transition",
            running ? "bg-cream-deep text-muted-2" : "bg-coral text-white hover:bg-coral-hover"
          )}
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </header>

      <div className="grid flex-1 grid-rows-2 gap-3 overflow-hidden px-3 pb-3 sm:px-5">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none rounded-xl border border-line bg-night-deep p-4 font-mono text-[13px] leading-relaxed text-cream focus:border-coral focus:outline-none dark:bg-[#0d0d12]"
        />
        <div className="overflow-auto rounded-xl border border-line bg-night-deep p-4 font-mono text-[13px] text-cream/90 dark:bg-[#0d0d12]">
          {error && <div className="mb-2 text-red-400">{error}</div>}
          {output || <span className="text-cream/40">Output will appear here...</span>}
        </div>
      </div>
    </div>
  );
}
