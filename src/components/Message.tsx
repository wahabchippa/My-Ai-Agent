import { useState } from "react";
import { Markdown } from "../lib/markdown";
import type { Message } from "../lib/store";
import { getModel } from "../lib/models";
import { speak, stopSpeaking } from "../lib/voice";
import {
  ClaudeLogo,
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
}: {
  lines: string[];
  done: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-line bg-cream/60 dark:border-night-surface dark:bg-night/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-muted"
      >
        <ChevronRight
          size={14}
          className={cn("transition-transform", open && "rotate-90")}
        />
        {done ? "Thought for a moment" : "Thinking…"}
      </button>
      {open && (
        <div className="animate-fade px-4 pb-3 pt-0.5 text-[13px] leading-relaxed text-muted">
          {lines.map((l, i) => (
            <p key={i} className="flex gap-2 py-0.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral/50" />
              <span>{l}</span>
            </p>
          ))}
          {!done && (
            <p className="flex items-center gap-1.5 py-0.5 text-muted-2">
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
            </p>
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

  const model = msg.model ? getModel(msg.model) : null;
  const pers = msg.personality ? getPersonality(msg.personality) : null;
  const isClaude = !pers || pers.id === "claude";

  return (
    <div className="group flex gap-3 px-4 py-3 sm:px-6">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: pers ? pers.color : "#D97757" }}
      >
        {isClaude ? <ClaudeLogo size={17} /> : <span className="text-[15px]">{pers!.emoji}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {model?.thinks && msg.thinking && msg.thinking.length > 0 && (
          <ThinkingTrace lines={msg.thinking} done={!msg.streaming} />
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
