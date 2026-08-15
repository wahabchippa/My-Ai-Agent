import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { getModel } from "../lib/models";
import type { ModelId } from "../lib/models";
import { ClaudeLogo, TerminalIcon, ChevronRight, PlusIcon } from "./icons";
import { cn } from "../utils/cn";

type LineKind =
  | "cmd"
  | "out"
  | "info"
  | "ok"
  | "err"
  | "muted"
  | "tool"
  | "add"
  | "del"
  | "diff-head";

interface TermLine {
  id: string;
  kind: LineKind;
  text: string;
  indent?: number;
}

interface Step {
  lines: TermLine[];
  delay: number;
}

let counter = 0;
const lid = () => `t${counter++}`;

const INITIAL: TermLine[] = [
  { id: lid(), kind: "muted", text: "Welcome to Nexora Code v1.0.42" },
  { id: lid(), kind: "muted", text: "" },
  { id: lid(), kind: "out", text: "✻ Press Enter to send a message, or type /help for commands." },
  { id: lid(), kind: "muted", text: "" },
  { id: lid(), kind: "info", text: "Tip: ask Nexora to build a feature, fix a bug, or write tests." },
];

const FILE_TREE: { name: string; depth: number; type: "dir" | "file"; tag?: string }[] = [
  { name: "apna-app", depth: 0, type: "dir" },
  { name: "src", depth: 1, type: "dir" },
  { name: "App.tsx", depth: 2, type: "file" },
  { name: "main.tsx", depth: 2, type: "file" },
  { name: "components", depth: 2, type: "dir" },
  { name: "Todo.tsx", depth: 3, type: "file", tag: "new" },
  { name: "index.css", depth: 2, type: "file" },
  { name: "package.json", depth: 1, type: "file" },
  { name: "README.md", depth: 1, type: "file" },
];

const HELP: TermLine[] = [
  { id: lid(), kind: "info", text: "Available commands:" },
  { id: lid(), kind: "out", text: "  /help        Show this help" },
  { id: lid(), kind: "out", text: "  /clear       Clear the terminal" },
  { id: lid(), kind: "out", text: "  /model       List or switch models" },
  { id: lid(), kind: "out", text: "  /cost        Show token usage & cost" },
  { id: lid(), kind: "out", text: "  /status      Show git status" },
  { id: lid(), kind: "out", text: "  /init        Initialize project memory" },
  { id: lid(), kind: "out", text: "  /compact     Compact conversation history" },
  { id: lid(), kind: "muted", text: "" },
  { id: lid(), kind: "muted", text: "Or just describe what you want to build, e.g.:" },
  { id: lid(), kind: "out", text: '  "build a todo app" · "fix the login bug" · "add unit tests"' },
];

function modelLines(model: ModelId): TermLine[] {
  const m = getModel(model);
  const line = (id: ModelId, name: string, desc: string): TermLine => ({
    id: lid(),
    kind: model === id ? "ok" : "out",
    text: `  ${id.padEnd(7)} ${name} — ${desc}`,
  });
  return [
    { id: lid(), kind: "info", text: "Models available:" },
    line("fable", "Nexora Ultra", "flagship, most capable"),
    line("opus", "Nexora Pro", "maximum intelligence"),
    line("sonnet", "Nexora Core", "balanced (default)"),
    line("haiku", "Nexora Flash", "fastest, lowest cost"),
    { id: lid(), kind: "muted", text: "" },
    { id: lid(), kind: "muted", text: `Active model: ${m.name}` },
    { id: lid(), kind: "muted", text: `Context: ${m.context} · Output: ${m.output} · ${m.alias}` },
    { id: lid(), kind: "muted", text: 'Use "/model <name>" to switch (e.g. /model opus).' },
  ];
}

const STATUS: TermLine[] = [
  { id: lid(), kind: "info", text: "On branch main" },
  { id: lid(), kind: "out", text: "Your branch is up to date with 'origin/main'." },
  { id: lid(), kind: "muted", text: "" },
  { id: lid(), kind: "out", text: "Changes not staged for commit:" },
  { id: lid(), kind: "del", text: "  modified:   src/App.tsx" },
  { id: lid(), kind: "add", text: "  new file:   src/components/Todo.tsx" },
  { id: lid(), kind: "muted", text: "" },
  { id: lid(), kind: "out", text: 'no changes added to commit (use "git add" and "git commit")' },
];

const INIT: TermLine[] = [
  { id: lid(), kind: "out", text: "Analyzing project structure…" },
  { id: lid(), kind: "ok", text: "✓ Created APNA.md with project guidelines." },
  { id: lid(), kind: "out", text: "  • Tech stack: React + Vite + TypeScript" },
  { id: lid(), kind: "out", text: "  • Style: Tailwind CSS" },
  { id: lid(), kind: "out", text: "  • Test runner: Vitest" },
  { id: lid(), kind: "ok", text: "✓ Memory initialized. Nexora will remember project context." },
];

/** Build a simulated agent workflow for a free-text request. */
function planFlow(prompt: string, model: ModelId): Step[] {
  const p = prompt.toLowerCase();
  const isTodo = p.includes("todo") || p.includes("task") || p.includes("app");
  const isBug = p.includes("bug") || p.includes("fix") || p.includes("error") || p.includes("debug");
  const isTest = p.includes("test") || p.includes("spec") || p.includes("coverage");

  const intro: TermLine[] = [
    { id: lid(), kind: "tool", text: `⏺ ${capitalize(prompt)}` },
    { id: lid(), kind: "muted", text: "" },
    { id: lid(), kind: "out", text: "I'll start by exploring the codebase to understand the structure." },
  ];

  const explore: Step = {
    delay: 480,
    lines: [
      { id: lid(), kind: "tool", text: "⎿  Read  src/App.tsx" },
      { id: lid(), kind: "tool", text: "⎿  Read  package.json" },
      { id: lid(), kind: "out", text: "  Found a React + TypeScript project with Tailwind." },
    ],
  };

  const plan: Step = {
    delay: 420,
    lines: [
      { id: lid(), kind: "muted", text: "" },
      { id: lid(), kind: "out", text: "Here's my plan:" },
      { id: lid(), kind: "out", text: `  1. ${isTodo ? "Create the Todo component" : isBug ? "Reproduce the failing case" : isTest ? "Set up the test file" : "Implement the requested feature"}` },
      { id: lid(), kind: "out", text: `  2. ${isTodo ? "Add state and handlers" : isBug ? "Trace the root cause" : isTest ? "Write the test cases" : "Wire it into the app"}` },
      { id: lid(), kind: "out", text: `  3. Run the test suite to verify` },
      { id: lid(), kind: "muted", text: "" },
    ],
  };

  const edit: Step = {
    delay: 520,
    lines: [
      { id: lid(), kind: "tool", text: `⏺ Edit src/components/Todo.tsx` },
      { id: lid(), kind: "diff-head", text: "@@ -0,0 +1,42 @@" },
      { id: lid(), kind: "add", text: "+ import { useState } from \"react\";" },
      { id: lid(), kind: "add", text: "+ export function Todo() {" },
      { id: lid(), kind: "add", text: "+   const [items, setItems] = useState<string[]>([]);" },
      { id: lid(), kind: "add", text: "+   // …add, toggle, clear handlers…" },
      { id: lid(), kind: "add", text: "+   return <ul>{items.map(/* … */)}</ul>;" },
      { id: lid(), kind: "add", text: "+ }" },
      { id: lid(), kind: "out", text: "  ⎿ Updated src/components/Todo.tsx (+42 lines)" },
      ...(isBug
        ? ([{ id: lid(), kind: "del", text: "- if (items = []) return null;" }, { id: lid(), kind: "add", text: "+ if (items.length === 0) return null;" }] as TermLine[])
        : []),
      { id: lid(), kind: "muted", text: "" },
    ],
  };

  const run: Step = {
    delay: 600,
    lines: [
      { id: lid(), kind: "tool", text: "⏺ Bash  $ npm run test" },
      { id: lid(), kind: "muted", text: "  > vitest run" },
      { id: lid(), kind: "out", text: "  ✓ src/components/Todo.test.tsx (3)" },
      { id: lid(), kind: "ok", text: "  Test Files  1 passed (1)" },
      { id: lid(), kind: "ok", text: "  Tests       3 passed (3)" },
      { id: lid(), kind: "muted", text: "" },
    ],
  };

  const summary: TermLine[] = [
    { id: lid(), kind: "ok", text: `✓ Done. ${isBug ? "Bug fixed and" : ""}All ${isTest ? "tests" : "checks"} passing.` },
    { id: lid(), kind: "muted", text: "" },
    { id: lid(), kind: "out", text: `Created ${isTodo ? "a working Todo component" : isBug ? "the fix" : isTest ? "the test suite" : "the feature"} using ${getModel(model).family}. Want me to add edge-case tests or style it?` },
    { id: lid(), kind: "muted", text: "" },
  ];

  return [
    { delay: 0, lines: intro },
    explore,
    plan,
    edit,
    run,
    { delay: 380, lines: summary },
  ];
}

function capitalize(s: string) {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const COLORS: Record<LineKind, string> = {
  cmd: "text-white font-medium",
  out: "text-stone-300",
  info: "text-sky-300",
  ok: "text-emerald-400",
  err: "text-red-400",
  muted: "text-stone-500",
  tool: "text-[#d97757] font-medium",
  add: "text-emerald-400/90",
  del: "text-red-400/90",
  "diff-head": "text-indigo-300",
};

export function CodeView({ onNewChat }: { onNewChat?: () => void }) {
  const { model, setModel } = useStore();
  const [lines, setLines] = useState<TermLine[]>(INITIAL);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState(0);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const cost = useMemo(() => (tokens / 1_000_000) * 15, [tokens]);

  const push = (newLines: TermLine[]) => setLines((prev) => [...prev, ...newLines]);
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runSteps = async (steps: Step[], costPerStep = 1200) => {
    setBusy(true);
    cancelRef.current = false;
    for (const step of steps) {
      if (cancelRef.current) break;
      await delay(step.delay);
      if (cancelRef.current) break;
      push(step.lines);
      setTokens((t) => t + costPerStep);
    }
    setBusy(false);
  };

  const handleCommand = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    push([{ id: lid(), kind: "cmd", text: `> ${text}` }]);
    setInput("");

    // slash commands
    if (text.startsWith("/")) {
      const [cmd, arg] = text.slice(1).split(/\s+/);
      if (cmd === "help") return push(HELP);
      if (cmd === "clear") return setLines([]);
      if (cmd === "status") return push(STATUS);
      if (cmd === "init") return await runSteps([{ delay: 300, lines: INIT }]);
      if (cmd === "compact")
        return push([
          { id: lid(), kind: "out", text: "Compacting conversation history…" },
          { id: lid(), kind: "ok", text: "✓ Compacted. History reduced by 64%." },
        ]);
      if (cmd === "cost")
        return push([
          { id: lid(), kind: "info", text: "Session usage:" },
          { id: lid(), kind: "out", text: `  Tokens: ${tokens.toLocaleString()}` },
          { id: lid(), kind: "out", text: `  Cost:   $${cost.toFixed(4)}` },
          { id: lid(), kind: "muted", text: "  Model:  " + getModel(model).name },
        ]);
      if (cmd === "model") {
        const valid: ModelId[] = ["opus", "sonnet", "fable", "haiku"];
        if (arg && valid.includes(arg as ModelId)) {
          setModel(arg as ModelId);
          return push([
            { id: lid(), kind: "ok", text: `✓ Switched to Nexora ${capitalize(arg)}.` },
          ]);
        }
        return push(modelLines(model));
      }
      return push([{ id: lid(), kind: "err", text: `Unknown command: /${cmd}. Type /help.` }]);
    }

    // free-text → agent flow
    await runSteps(planFlow(text, model));
  };

  return (
    <div className="flex h-full flex-col bg-[#1a1a18] text-stone-200">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-2 flex items-center gap-1.5 text-[13px] font-medium text-stone-300">
            <TerminalIcon size={15} className="text-[#d97757]" />
            claude — ~/claude-app
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-stone-400">
          <span className="hidden items-center gap-1.5 sm:flex">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: getModel(model).accent }}
            />
            {getModel(model).family}
          </span>
          <span className="hidden sm:inline">{tokens.toLocaleString()} tok</span>
          <span className="tabular-nums">${cost.toFixed(4)}</span>
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-stone-300 transition hover:bg-white/10"
            title="New session"
          >
            <PlusIcon size={13} /> <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Terminal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="scanline min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed sm:px-6"
          >
            {lines.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  COLORS[l.kind],
                  l.kind === "cmd" && "mt-2"
                )}
                style={l.indent ? { paddingLeft: l.indent * 16 } : undefined}
              >
                {l.text || "\u00A0"}
              </div>
            ))}
            {busy && (
              <div className="mt-1 flex items-center gap-2 text-[#d97757]">
                <span className="flex gap-1">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-[#d97757]" />
                  <span
                    className="dot h-1.5 w-1.5 rounded-full bg-[#d97757]"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="dot h-1.5 w-1.5 rounded-full bg-[#d97757]"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
                <span className="text-stone-500">Nexora is working…</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 px-4 py-3 sm:px-6">
            <div
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition focus-within:border-[#d97757]/60"
              onClick={() => inputRef.current?.focus()}
            >
              <ChevronRight size={15} className="shrink-0 text-[#d97757]" />
              <input
                ref={inputRef}
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommand(input);
                }}
                placeholder={busy ? "Nexora is working…" : "Ask Nexora to code…  (/help)"}
                className="w-full bg-transparent font-mono text-[13px] text-stone-100 placeholder:text-stone-500 focus:outline-none"
              />
              {busy ? (
                <button
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="shrink-0 rounded bg-red-500/80 px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-red-500"
                >
                  Stop
                </button>
              ) : (
                <kbd className="hidden shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-stone-400 sm:block">
                  ↵
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* File explorer */}
        <aside className="hidden w-60 shrink-0 flex-col border-l border-white/10 bg-[#161614] lg:flex">
          <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4 text-[13px]">
            {FILE_TREE.map((f) => (
              <div
                key={f.name}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-1 text-stone-400",
                  f.tag === "new" && "text-emerald-400"
                )}
                style={{ paddingLeft: 8 + f.depth * 14 }}
              >
                <span className="text-stone-600">
                  {f.type === "dir" ? "▸" : "·"}
                </span>
                <span className={f.type === "dir" ? "font-medium text-stone-300" : ""}>
                  {f.name}
                </span>
                {f.tag && (
                  <span className="ml-auto rounded bg-emerald-500/15 px-1.5 text-[10px] font-semibold uppercase text-emerald-400">
                    {f.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2 text-[12px] text-stone-400">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#d97757]/20 text-[#d97757]">
                <ClaudeLogo size={14} />
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-200">
                  {getModel(model).name}
                </div>
                <div className="truncate text-[11px] text-stone-500">
                  {getModel(model).tagline}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
