import { useState } from "react";
import { Markdown } from "../lib/markdown";
import type { Message, TraceAgent, TraceState, TraceStep } from "../lib/store";
import { speak, stopSpeaking } from "../lib/voice";
import {
  CopyIcon,
  CheckIcon,
  RefreshIcon,
  ThumbUp,
  ThumbDown,
  PencilIcon,
  SpeakerIcon,
  ChevronRight,
  SparkleIcon,
} from "./icons";
import { getPersonality } from "../lib/personalities";
import { cn } from "../utils/cn";

/** Purani string lines se chips nikaalo — taake purani chats bhi sahi dikhein. */
function parseThinkingLines(lines: string[]): TraceState | null {
  const agents: TraceAgent[] = [];
  const steps: TraceStep[] = [];
  let kind: TraceState["kind"] = "deep";
  let verify: TraceState["verify"];
  let sawStructured = false;

  const upsert = (name: string, status: TraceAgent["status"], emoji = "⚙️") => {
    const id = name.toLowerCase();
    const ex = agents.find((a) => a.id === id || a.name === name);
    if (ex) ex.status = status;
    else agents.push({ id, name, emoji, color: "#D97757", status });
  };

  for (const raw of lines) {
    const l = raw.trim();
    const team = l.match(/^👥\s*Team:\s*(.+)/i);
    if (team) {
      sawStructured = true;
      kind = "agents";
      for (const part of team[1].split("·")) {
        const m = part.trim().match(/^(\S+)\s+(.+)$/);
        if (m) upsert(m[2].trim(), "pending", m[1]);
      }
      continue;
    }
    const start = l.match(/^⏳\s*(.+?)\s+working/i);
    if (start) {
      sawStructured = true;
      kind = "agents";
      upsert(start[1].trim(), "running");
      continue;
    }
    const ok = l.match(/^✅\s*(.+?)\s+done/i);
    if (ok) {
      sawStructured = true;
      upsert(ok[1].trim(), "done");
      continue;
    }
    const skip = l.match(/^⚠(?:️)?\s*(.+?)\s+skipped/i);
    if (skip) {
      sawStructured = true;
      upsert(skip[1].trim(), "skipped");
      continue;
    }
    if (/code verified/i.test(l)) {
      sawStructured = true;
      verify = "passed";
      continue;
    }
    if (/auto-fixed/i.test(l)) {
      sawStructured = true;
      verify = "fixed";
      continue;
    }
    if (/code failed/i.test(l)) {
      sawStructured = true;
      verify = "failed";
      continue;
    }
    if (/^(🔎|🌐|▶️|📚|⚙️)/.test(l)) {
      sawStructured = true;
      const label = l.replace(/^(🔎|🌐|▶️|📚|⚙️)\s*/, "");
      if (!steps.some((s) => s.label === label)) {
        steps.push({ id: `s${steps.length}`, label, status: "done" });
      }
    }
  }

  if (!sawStructured) return null;
  return { kind, agents, steps, verify };
}

function AgentChip({ agent }: { agent: TraceAgent }) {
  const run = agent.status === "running";
  const ok = agent.status === "done";
  const skip = agent.status === "skipped";
  return (
    <span
      title={agent.role ? `${agent.name} · ${agent.role}${agent.model ? ` · ${agent.model}` : ""}` : agent.name}
      style={{ ["--chip" as string]: agent.color }}
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
        run && "agent-chip-run",
        ok && "border-emerald-400/50 bg-emerald-500/10 text-ink dark:text-cream",
        skip && "border-amber-400/40 bg-amber-500/10 text-muted line-through decoration-amber-500/60",
        agent.status === "pending" && "border-line bg-cream-deep/60 text-muted dark:border-night-surface dark:bg-night-surface/50",
        run && "border-transparent text-ink dark:text-cream",
      )}
    >
      {run && (
        <span
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundColor: agent.color }}
        />
      )}
      {run && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `inset 0 0 0 1.5px ${agent.color}` }}
        />
      )}
      <span className="relative text-[13px] leading-none">{agent.emoji}</span>
      <span className="relative">{agent.name}</span>
      {run && (
        <span className="relative h-3 w-3 shrink-0 rounded-full border-[1.5px] border-current/25 border-t-current animate-spin" />
      )}
      {ok && (
        <span className="relative text-emerald-600 dark:text-emerald-400">
          <CheckIcon size={12} />
        </span>
      )}
      {skip && <span className="relative text-[10px] text-amber-600">skip</span>}
    </span>
  );
}

export function firstCodeBlock(md: string) {
  const m = md.match(/```(\w*)\r?\n([\s\S]*?)```/);
  if (!m) return null;
  return { lang: m[1] || "code", code: m[2].replace(/\n$/, "") };
}

export const LANG_FILE: Record<string, string> = {
  html: "index.html",
  javascript: "script.js",
  js: "script.js",
  typescript: "script.ts",
  ts: "script.ts",
  tsx: "Component.tsx",
  jsx: "Component.jsx",
  react: "Component.jsx",
  python: "snippet.py",
  py: "snippet.py",
  css: "styles.css",
  sql: "query.sql",
  json: "data.json",
};

function ThinkingTrace({
  lines,
  done,
  trace: rawTrace,
}: {
  lines: string[];
  done: boolean;
  trace?: TraceState;
}) {
  const [open, setOpen] = useState(true);
  const parsed = rawTrace ?? parseThinkingLines(lines);
  const agents = parsed?.agents ?? [];
  const steps = parsed?.steps ?? [];
  const running = agents.filter((a) => a.status === "running");
  const finished = agents.filter((a) => a.status === "done" || a.status === "skipped").length;
  // same line baar baar na dikhe — purana fallback
  const plain = !parsed ? lines.filter((l, i, arr) => arr.indexOf(l) === i) : [];

  const headline = done
    ? agents.length
      ? `Done · ${agents.length} agent${agents.length === 1 ? "" : "s"}`
      : "Done"
    : running.length
      ? running.map((a) => a.name).join(" · ")
      : parsed?.phase === "research"
        ? "Gathering sources"
        : parsed?.phase === "synthesis"
          ? "Synthesizing"
          : parsed?.phase === "verify"
            ? "Verifying code"
            : steps.find((s) => s.status === "running")?.label
              || lines[lines.length - 1]
              || (parsed?.kind === "deep" ? "Deep Think" : "Thinking");

  const total = agents.length;
  const pct = done
    ? 100
    : total
      ? Math.round((finished / total) * 100)
      : steps.length
        ? Math.round((steps.filter((s) => s.status === "done").length / Math.max(steps.length, 1)) * 90)
        : 12;

  const showBody = open && (agents.length > 0 || steps.length > 0 || plain.length > 0 || !!parsed?.verify);

  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-line bg-cream/70 dark:border-night-surface dark:bg-night/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-cream-deep/60 dark:hover:bg-night-surface/40"
        aria-live="polite"
      >
        {done ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckIcon size={14} />
          </span>
        ) : (
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-coral/25 border-t-coral animate-spin" />
            <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-coral/20" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink dark:text-cream">
          {headline}
        </span>
        {total > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted">
            {finished}/{total}
          </span>
        )}
        <ChevronRight
          size={14}
          className={cn("shrink-0 text-muted-2 transition-transform", open && "rotate-90")}
        />
      </button>

      {/* thin progress — agents complete hone par bhar'ta hai */}
      <div className="h-[2px] w-full bg-line/70 dark:bg-night-surface">
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            done ? "bg-emerald-500" : "bg-coral",
            !done && !total && "animate-pulse",
          )}
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>

      {showBody && (
        <div className="animate-fade-in space-y-2.5 px-3 py-2.5">
          {agents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agents.map((a) => (
                <AgentChip key={a.id} agent={a} />
              ))}
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-1">
              {steps.map((s) => {
                const live = s.status === "running" && !done;
                return (
                  <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
                    {s.status === "done" || done ? (
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckIcon size={12} />
                      </span>
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-coral/30 border-t-coral animate-spin" />
                    )}
                    <span className={live ? "text-ink dark:text-cream" : "text-muted"}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {plain.length > 0 && (
            <div className="space-y-1.5">
              {plain.map((l) => {
                const isCurrent = l === plain[plain.length - 1] && !done;
                return (
                  <div key={l} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition",
                        isCurrent ? "animate-pulse bg-coral" : "bg-coral/40",
                      )}
                    />
                    <span className={isCurrent ? "text-ink dark:text-cream" : "text-muted"}>{l}</span>
                  </div>
                );
              })}
            </div>
          )}

          {parsed?.verify && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                parsed.verify === "failed"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {parsed.verify === "passed" && "✓ Code verified"}
              {parsed.verify === "fixed" && "✓ Code auto-fixed"}
              {parsed.verify === "failed" && "⚠ Code failed the check"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Actions({
  msg,
  onRegenerate,
  onFeedback,
}: {
  msg: Message;
  onRegenerate?: () => void;
  onFeedback?: (v: "up" | "down") => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-muted-2 transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream";
  const savePdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const escaped = msg.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Nexora Report</title>` +
        `<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.65;color:#1f1e1d}` +
        `pre{white-space:pre-wrap;word-wrap:break-word;font-family:Georgia,serif;font-size:15px}` +
        `h1{font-family:system-ui;color:#d97757}</style></head>` +
        `<body><h1>Nexora — Report</h1><pre>${escaped}</pre>` +
        `<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>` +
        `</body></html>`
    );
    w.document.close();
  };
  return (
    <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
      <button className={btn} onClick={copy} title="Copy">
        {copied ? (
          <CheckIcon size={15} className="text-emerald-600" />
        ) : (
          <CopyIcon size={15} />
        )}
      </button>
      <button className={btn} onClick={savePdf} title="Save as PDF">
        <span className="text-[10px] font-bold tracking-tight text-muted-2">PDF</span>
      </button>
      <button
        className={btn}
        onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : (speak(msg.content), setSpeaking(true)))}
        title="Listen (text-to-speech)"
      >
        <SpeakerIcon size={15} className={speaking ? "text-coral" : ""} />
      </button>
      {onRegenerate && (
        <button className={btn} onClick={onRegenerate} title="Regenerate">
          <RefreshIcon size={15} />
        </button>
      )}
      <button
        className={cn(btn, msg.feedback === "up" && "text-coral")}
        onClick={() => onFeedback?.("up")}
        title="Good response"
      >
        <ThumbUp size={15} />
      </button>
      <button
        className={cn(btn, msg.feedback === "down" && "text-coral")}
        onClick={() => onFeedback?.("down")}
        title="Bad response"
      >
        <ThumbDown size={15} />
      </button>
    </div>
  );
}

export function MessageItem({
  msg,
  isLast,
  onRegenerate,
  onFeedback,
  onOpenArtifact,
}: {
  msg: Message;
  isLast: boolean;
  onRegenerate?: () => void;
  onFeedback?: (v: "up" | "down") => void;
  onOpenArtifact?: (a: { title: string; lang: string; code: string }) => void;
}) {
  const codeBlock = msg.role === "assistant" ? firstCodeBlock(msg.content) : null;
  if (msg.role === "user") {
    return (
      <div className="group flex justify-end px-4 py-3 sm:px-6">
        <div className="flex max-w-[78%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-md bg-cream-deep px-4 py-2.5 text-[15px] leading-relaxed text-ink-soft dark:bg-night-surface dark:text-cream/90">
            {msg.content}
          </div>
          <div className="opacity-0 transition group-hover:opacity-100">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-2 transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface">
              <PencilIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pers = msg.personality ? getPersonality(msg.personality) : null;
  const isClaude = !pers || pers.id === "claude";

  return (
    <div className="group flex gap-3 px-4 py-3 sm:px-6">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: pers ? pers.color : "#D97757" }}
      >
        {isClaude ? <img src="/nexora-logo.png" alt="Nexora" className="h-5 w-5 rounded-full object-cover" /> : <span className="text-[15px]">{pers!.emoji}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {(msg.trace || (msg.thinking && msg.thinking.length > 0)) && (
          <ThinkingTrace lines={msg.thinking ?? []} done={!msg.streaming} trace={msg.trace} />
        )}
        {msg.content ? (
          <div>
            <Markdown text={msg.content} />
            {msg.streaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-[2px] animate-pulse bg-coral align-middle" />
            )}
          </div>
        ) : (
          msg.streaming &&
          !msg.trace &&
          !(msg.thinking && msg.thinking.length > 0) && (
            <div className="flex items-center gap-1.5 py-1 text-[12px] text-muted">
              <span className="flex gap-1">
                <span className="dot h-1.5 w-1.5 rounded-full bg-coral" />
                <span
                  className="dot h-1.5 w-1.5 rounded-full bg-coral"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="dot h-1.5 w-1.5 rounded-full bg-coral"
                  style={{ animationDelay: "0.3s" }}
                />
              </span>
            </div>
          )
        )}
        {!msg.streaming && msg.content && codeBlock && onOpenArtifact && (
          <button
            onClick={() =>
              onOpenArtifact({
                title: LANG_FILE[codeBlock.lang] || "snippet.txt",
                lang: codeBlock.lang,
                code: codeBlock.code,
              })
            }
            className="group/art mt-2.5 flex items-center gap-2.5 rounded-xl border border-line bg-cream px-3 py-2 text-left transition hover:border-coral/40 hover:shadow-sm dark:border-night-surface dark:bg-night"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral/12 text-coral">
              <SparkleIcon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink dark:text-cream">
                {LANG_FILE[codeBlock.lang] || "snippet.txt"}
              </span>
              <span className="block text-[11px] text-muted">
                Open in Artifacts
              </span>
            </span>
            <ChevronRight
              size={15}
              className="ml-auto text-muted-2 transition group-hover/art:translate-x-0.5 group-hover/art:text-coral"
            />
          </button>
        )}
        {!msg.streaming && msg.content && (
          <Actions
            msg={msg}
            onRegenerate={isLast ? onRegenerate : undefined}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}
