"use client";

import { useState } from "react";
import { buildAnything } from "../lib/builder";
import { cn } from "../utils/cn";

interface Props {
  onOpenSidebar?: () => void;
}

export function ProjectsView({ onOpenSidebar }: Props) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("My Project");
  const [html, setHtml] = useState<string | null>(null);

  const build = () => {
    const t = prompt.trim();
    if (!t) return;
    const app = buildAnything(t);
    setTitle(app.title);
    setHtml(app.html);
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
        <div>
          <div className="text-[15px] font-semibold text-ink dark:text-cream">Projects · App Builder</div>
          <div className="text-[11px] text-muted">Describe an app and it will be built & previewed live</div>
        </div>
      </header>

      <div className="flex items-end gap-2 px-3 pb-3 sm:px-5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") build(); }}
          placeholder='e.g. "build a calculator", "todo app", "cafe website"...'
          className="flex-1 rounded-xl border border-line bg-cream-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
        />
        <button
          onClick={build}
          disabled={!prompt.trim()}
          className={cn(
            "rounded-xl px-5 py-2.5 text-sm font-semibold transition",
            prompt.trim() ? "bg-coral text-white hover:bg-coral-hover" : "bg-cream-deep text-muted-2 dark:bg-night-surface"
          )}
        >
          Build
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-3 pb-3 sm:px-5">
        {html ? (
          <iframe
            title={title}
            srcDoc={html}
            sandbox="allow-scripts"
            className="h-full w-full rounded-xl border border-line bg-white dark:border-night-surface"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <div className="text-center">
              <div className="text-5xl mb-3">🛠️</div>
              <p className="text-sm">Type an idea above and press Build to see it here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
