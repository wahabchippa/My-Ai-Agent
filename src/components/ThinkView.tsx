"use client";

// ═══════════════════════════════════════════════════════════════════════
// NEXORA — DEEP THINK
//
// Agents tab se farq:
//   Agents = kai specialists, har ek EK baar bolta hai (fixed pipeline)
//   Think  = EK model, magar tools ke sath, jitni baar zaroorat ho
//
// Yahan user ko har qadam LIVE dikhta hai: model ne kya socha, kaunsa
// tool chalaya, asal me kya wapas aaya. Yehi cheez agent ko "zinda"
// mehsoos karati hai — warna 40 second khaali screen aur phir jawab.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Markdown } from "../lib/markdown";
import { cn } from "../utils/cn";
import {
  MenuIcon, ArrowUp, StopIcon, CheckIcon, SearchIcon,
  TerminalIcon, GlobeIcon, BookIcon, BrainIcon,
} from "./icons";

interface Props {
  onOpenSidebar?: () => void;
}

interface Step {
  n: number;
  thought: string;
  tool?: string;
  input?: string;
  output?: string;
  ok?: boolean;
  ms: number;
}

const TOOL_META: Record<string, { icon: typeof SearchIcon; label: string; color: string }> = {
  web_search: { icon: SearchIcon, label: "Searched the web", color: "#3b82f6" },
  read_url: { icon: GlobeIcon, label: "Read a page", color: "#8b5cf6" },
  run_code: { icon: TerminalIcon, label: "Ran code", color: "#10b981" },
  recall: { icon: BookIcon, label: "Checked knowledge", color: "#f59e0b" },
};

const EXAMPLES = [
  "What is the latest stable Next.js version, and what changed?",
  "Write a function to parse ISO durations — test it before answering",
  "Is Bun faster than Node for HTTP servers? Check real benchmarks",
];

export function ThinkView({ onOpenSidebar }: Props) {
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [final, setFinal] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [steps, final]);

  const run = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    setSteps([]);
    setFinal("");
    setOpen(null);
    startRef.current = Date.now();
    setElapsed(0);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/think?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, maxSteps: 5 }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "start") setModel(String(ev.model));
          else if (ev.type === "retry") setModel(String(ev.model));
          else if (ev.type === "step") setSteps((p) => [...p, ev.step as Step]);
          else if (ev.type === "done") {
            setFinal(String(ev.final ?? ""));
            setModel(String(ev.model ?? ""));
          } else if (ev.type === "error") setError(String(ev.message));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const idle = !busy && !final && !steps.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 dark:border-night-surface">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep md:hidden dark:hover:bg-night-surface"
        >
          <MenuIcon size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink dark:text-cream">Deep Think</div>
          <div className="truncate text-[11.5px] text-muted">
            {busy
              ? `Working… ${elapsed}s`
              : model
                ? `${model} · ${steps.length} tool${steps.length === 1 ? "" : "s"} used`
                : "Searches, reads and runs code until it is sure"}
          </div>
        </div>
        {(final || steps.length > 0) && !busy && (
          <button
            onClick={() => {
              setSteps([]);
              setFinal("");
              setModel("");
            }}
            className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-muted transition hover:border-coral/40 hover:text-coral dark:border-night-surface"
          >
            New
          </button>
        )}
      </div>

      {/* body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {idle && (
            <div className="flex flex-col items-center pt-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-coral-hover text-white shadow-[0_10px_30px_rgba(217,119,87,0.35)]">
                <BrainIcon size={26} />
              </div>
              <div className="text-[15px] font-semibold text-ink dark:text-cream">
                Ask something that needs checking
              </div>
              <p className="mt-1 max-w-md text-[12.5px] text-muted">
                This agent decides for itself when to search the web, read a page, or run
                code — and keeps going until it has a real answer.
              </p>
              <div className="mt-4 flex w-full max-w-lg flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => run(ex)}
                    className="rounded-lg border border-line px-3 py-2 text-left text-[12.5px] text-ink-soft transition hover:border-coral/40 hover:text-coral dark:border-night-surface dark:text-cream/75"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* steps */}
          {steps.map((s) => {
            const meta = TOOL_META[s.tool ?? ""] ?? {
              icon: BrainIcon,
              label: s.tool ?? "step",
              color: "#888",
            };
            const Icon = meta.icon;
            const isOpen = open === s.n;
            return (
              <div key={s.n} className="animate-rise mb-2">
                <button
                  onClick={() => setOpen(isOpen ? null : s.n)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-cream px-3 py-2.5 text-left transition hover:border-coral/30 dark:border-night-surface dark:bg-night-surface/40"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${meta.color}1a`, color: meta.color }}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink dark:text-cream">
                      {meta.label}
                      {s.ok === false && (
                        <span className="rounded bg-rose-500/10 px-1.5 text-[10px] text-rose-500">retried</span>
                      )}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {s.thought || s.input}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted-2">
                    {(s.ms / 1000).toFixed(1)}s
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-1 rounded-xl border border-line bg-cream-deep/40 p-3 dark:border-night-surface dark:bg-night-surface/20">
                    <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                      Input
                    </div>
                    <pre className="mb-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-ink-soft dark:text-cream/70">
                      {s.input}
                    </pre>
                    <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                      What came back
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-ink-soft dark:text-cream/70">
                      {s.output}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-2 px-1 py-2 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" />
              thinking…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12.5px] text-rose-500">
              {error}
            </div>
          )}

          {final && (
            <div className="animate-rise mt-3 rounded-2xl border-2 border-coral/30 bg-cream p-4 dark:bg-night-surface/40">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-coral">
                <CheckIcon size={13} /> Answer
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(final).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    });
                  }}
                  className="ml-auto rounded-md px-1.5 py-1 text-[11px] font-medium normal-case tracking-normal text-muted transition hover:text-coral"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <Markdown text={final} />
            </div>
          )}
        </div>
      </div>

      {/* input */}
      <div className="border-t border-line px-4 py-3 dark:border-night-surface">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border border-line bg-cream px-3 py-2 focus-within:border-coral/50 dark:border-night-surface dark:bg-night-surface/40">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(task);
                setTask("");
              }
            }}
            rows={1}
            disabled={busy}
            placeholder="Ask anything — it will check before answering…"
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none disabled:opacity-50 dark:text-cream"
          />
          <button
            onClick={() => {
              if (busy) abortRef.current?.abort();
              else {
                run(task);
                setTask("");
              }
            }}
            disabled={!busy && !task.trim()}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition",
              busy
                ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                : task.trim()
                  ? "bg-coral text-white hover:bg-coral-hover"
                  : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface",
            )}
          >
            {busy ? (
              <>
                <StopIcon size={13} /> {elapsed}s
              </>
            ) : (
              <ArrowUp size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
