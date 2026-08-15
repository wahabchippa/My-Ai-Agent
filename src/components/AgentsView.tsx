import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AGENTS,
  MASTER,
  getAgent,
  orchestrate,
  type AgentId,
  type Orchestration,
  type Stage,
} from "../lib/agents";
import { Markdown } from "../lib/markdown";
import { ArtifactsPanel, type Artifact } from "./ArtifactsPanel";
import { newId } from "../lib/store";
import { ClaudeLogo, MenuIcon, ArrowUp, StopIcon, CheckIcon, SparkleIcon } from "./icons";
import { cn } from "../utils/cn";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "idle" | "planning" | "running" | "done";

const EXAMPLES = [
  "Build a todo app and test it",
  "Research black holes and write a short report",
  "Create a website for a coffee brand",
  "Analyze the pros and cons of remote work",
];

export function AgentsView({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [orch, setOrch] = useState<Orchestration | null>(null);
  const [log, setLog] = useState<Stage[]>([]);
  const [current, setCurrent] = useState<AgentId | null>(null);
  const [done, setDone] = useState<Set<AgentId>>(new Set());
  const [finalShown, setFinalShown] = useState("");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const cancelRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [log, current, finalShown]);

  const run = async (taskText: string) => {
    const text = taskText.trim();
    if (!text) return;
    cancelRef.current = false;
    const o = orchestrate(text);
    setOrch(o);
    setLog([]);
    setDone(new Set());
    setCurrent(null);
    setFinalShown("");
    setArtifact(null);
    setPhase("planning");
    await delay(950);
    if (cancelRef.current) {
      setPhase("done");
      return;
    }
    setPhase("running");
    for (const stage of o.stages) {
      if (cancelRef.current) break;
      setCurrent(stage.agentId);
      await delay(stage.ms);
      if (cancelRef.current) break;
      setLog((prev) => [...prev, stage]);
      setDone((prev) => new Set(prev).add(stage.agentId));
      setCurrent(null);
      await delay(180);
    }
    if (cancelRef.current) {
      setPhase("done");
      return;
    }
    // stream the final deliverable
    const tokens = o.final.match(/\s+|\S+/g) ?? [o.final];
    const chunk = Math.max(1, Math.ceil(tokens.length / 60));
    let acc = "";
    for (let i = 0; i < tokens.length; i += chunk) {
      if (cancelRef.current) break;
      acc += tokens.slice(i, i + chunk).join("");
      setFinalShown(acc);
      await delay(16);
    }
    setFinalShown(o.final);
    if (o.artifact) {
      setArtifact({ id: newId(), ...o.artifact });
    }
    setPhase("done");
  };

  const stop = () => {
    cancelRef.current = true;
  };

  const reset = () => {
    cancelRef.current = true;
    setPhase("idle");
    setOrch(null);
    setLog([]);
    setDone(new Set());
    setCurrent(null);
    setFinalShown("");
    setArtifact(null);
  };

  const busy = phase === "planning" || phase === "running";

  return (
    <div className="relative flex h-full">
      <div className="relative flex min-w-0 flex-1 flex-col bg-cream dark:bg-night">
        {/* header */}
        <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
          <button
            onClick={onOpenSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream-deep lg:hidden dark:text-cream"
          >
            <MenuIcon size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral text-white">
              <span className="text-[14px]">{MASTER.emoji}</span>
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold text-ink dark:text-cream">
                {MASTER.name} <span className="font-normal text-muted">· {MASTER.role}</span>
              </div>
              <div className="hidden text-[11px] text-muted sm:block">
                Master agent that recruits & runs a specialist team
              </div>
            </div>
          </div>
          {phase !== "idle" && (
            <button
              onClick={reset}
              className="ml-auto rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-cream-deep dark:border-night-surface dark:text-cream"
            >
              New task
            </button>
          )}
        </header>

        {phase === "idle" ? (
          <IdleHome onRun={run} examples={EXAMPLES} />
        ) : (
          <RunningView
            orch={orch}
            phase={phase}
            log={log}
            current={current}
            done={done}
            finalShown={finalShown}
            busy={busy}
            logRef={logRef}
            artifact={artifact}
            onStop={stop}
          />
        )}
      </div>

      {artifact && (
        <ArtifactsPanel
          key={artifact.id}
          artifact={artifact}
          onClose={() => setArtifact(null)}
          className="absolute inset-0 z-40 md:static md:inset-auto md:w-[440px] md:shrink-0 lg:w-[500px]"
        />
      )}
    </div>
  );
}

/* --------------------------------- idle ----------------------------------- */
function IdleHome({
  onRun,
  examples,
}: {
  onRun: (t: string) => void;
  examples: string[];
}) {
  const [text, setText] = useState("");
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-10">
      <div className="w-full max-w-2xl pt-6">
        <div className="relative mb-6 flex flex-col items-center text-center">
          <div className="claude-glow pointer-events-none absolute inset-0 -z-10 scale-[2.4]" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-coral-hover text-[34px] shadow-[0_10px_30px_rgba(217,119,87,0.4)]">
            {MASTER.emoji}
          </div>
          <h1 className="mt-4 font-serif text-[26px] text-ink dark:text-cream">
            Meet <span className="text-coral">{MASTER.name}</span>, your master agent
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
            Give {MASTER.name} any task. It will plan the work, hand each part to
            the best specialist, and deliver one polished result.
          </p>
        </div>

        {/* the team */}
        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {AGENTS.map((a) => (
            <div
              key={a.id}
              className="flex flex-col items-start gap-1.5 rounded-2xl border border-line bg-cream p-3 dark:border-night-surface dark:bg-night-surface/50"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px]"
                style={{ backgroundColor: a.color + "1f" }}
              >
                {a.emoji}
              </span>
              <div className="text-[13px] font-semibold text-ink dark:text-cream">
                {a.name}
              </div>
              <div className="text-[11px] leading-tight text-muted">{a.role}</div>
            </div>
          ))}
        </div>

        {/* input */}
        <div className="rounded-[24px] border border-line bg-cream p-2 shadow-[0_2px_14px_rgba(60,50,30,0.07)] focus-within:border-coral/50 dark:border-night-surface dark:bg-night">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onRun(text);
                setText("");
              }
            }}
            rows={2}
            placeholder="Describe a task for the team — e.g. build, research, write…"
            className="block w-full resize-none bg-transparent px-3 pt-2 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:outline-none dark:text-cream"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-[11px] text-muted-2">
              {MASTER.name} will pick the right agents
            </span>
            <button
              onClick={() => {
                onRun(text);
                setText("");
              }}
              disabled={!text.trim()}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                text.trim()
                  ? "bg-coral text-white hover:bg-coral-hover"
                  : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
              )}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => onRun(ex)}
              className="rounded-full border border-line bg-cream px-3.5 py-1.5 text-[12.5px] text-ink-soft transition hover:border-coral/40 hover:text-coral dark:border-night-surface dark:text-cream/80"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- running ---------------------------------- */
function agentStatus(
  id: AgentId,
  selected: AgentId[],
  current: AgentId | null,
  done: Set<AgentId>
): "standby" | "queued" | "working" | "done" {
  if (done.has(id)) return "done";
  if (current === id) return "working";
  if (selected.includes(id)) return "queued";
  return "standby";
}

function RunningView({
  orch,
  phase,
  log,
  current,
  done,
  finalShown,
  busy,
  logRef,
  artifact,
  onStop,
}: {
  orch: Orchestration | null;
  phase: Phase;
  log: Stage[];
  current: AgentId | null;
  done: Set<AgentId>;
  finalShown: string;
  busy: boolean;
  logRef: RefObject<HTMLDivElement | null>;
  artifact: Artifact | null;
  onStop: () => void;
}) {
  if (!orch) return null;
  const selected = orch.selected;

  return (
    <>
      <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-1 sm:px-6">
          {/* task brief */}
          <div className="animate-rise mb-4 rounded-2xl border border-line bg-cream-surface/60 p-4 dark:border-night-surface dark:bg-night-surface/40">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <SparkleIcon size={13} /> Task
            </div>
            <div className="text-[15px] font-medium text-ink dark:text-cream">
              {orch.subject}
            </div>
          </div>

          {/* plan */}
          <div className="animate-rise mb-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink dark:text-cream">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-[12px] text-white">
                {MASTER.emoji}
              </span>
              {MASTER.name}'s plan
            </div>
            <ol className="space-y-1.5 pl-1">
              {orch.plan.map((step, i) => {
                const stepDone = phase === "running" || phase === "done";
                return (
                  <li key={i} className="flex gap-2.5 text-[14px] text-ink-soft dark:text-cream/80">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        stepDone
                          ? "bg-coral/15 text-coral"
                          : "bg-cream-deep text-muted dark:bg-night-surface"
                      )}
                    >
                      {stepDone ? <CheckIcon size={12} /> : i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* agent status grid */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
            {AGENTS.map((a) => {
              const st = agentStatus(a.id, selected, current, done);
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition",
                    st === "working"
                      ? "border-coral/50 bg-coral-soft dark:bg-coral/15"
                      : st === "done"
                      ? "border-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-500/10"
                      : st === "queued"
                      ? "border-line bg-cream dark:border-night-surface dark:bg-night-surface/60"
                      : "border-transparent opacity-40"
                  )}
                >
                  <span className="relative text-[20px]">
                    {a.emoji}
                    {st === "working" && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-spin-slow rounded-full border-2 border-coral border-t-transparent" />
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-ink dark:text-cream">
                    {a.name}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      st === "done"
                        ? "text-emerald-600"
                        : st === "working"
                        ? "text-coral"
                        : "text-muted-2"
                    )}
                  >
                    {st === "done" ? "done" : st === "working" ? "working" : st === "queued" ? "queued" : "standby"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* planning indicator */}
          {phase === "planning" && (
            <div className="animate-fade mb-3 flex items-center gap-2 rounded-xl border border-line bg-cream p-3 text-[13px] text-muted dark:border-night-surface dark:bg-night">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-[12px] text-white">
                {MASTER.emoji}
              </span>
              <span className="flex items-center gap-1.5">
                Analyzing the task and assembling the team
                <span className="flex gap-1">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-coral" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.15s" }} />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.3s" }} />
                </span>
              </span>
            </div>
          )}

          {/* activity timeline */}
          <div className="space-y-3">
            {log.map((stage, i) => {
              const a = getAgent(stage.agentId);
              return (
                <div key={i} className="animate-rise flex gap-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px]"
                    style={{ backgroundColor: a.color + "22" }}
                  >
                    {a.emoji}
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-line bg-cream p-3.5 dark:border-night-surface dark:bg-night-surface/40">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink dark:text-cream">
                        {a.name}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ backgroundColor: a.color + "22", color: a.color }}
                      >
                        {a.role}
                      </span>
                      <span className="text-[11px] text-muted-2">· {stage.action}</span>
                    </div>
                    <Markdown text={stage.output} />
                  </div>
                </div>
              );
            })}

            {/* current working indicator */}
            {busy && current && (
              <div className="animate-fade flex items-center gap-3 pl-1 text-[13px] text-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-[16px]"
                  style={{ backgroundColor: getAgent(current).color + "22" }}>
                  {getAgent(current).emoji}
                </span>
                <span className="flex items-center gap-1.5">
                  {getAgent(current).name} is working
                  <span className="flex gap-1">
                    <span className="dot h-1.5 w-1.5 rounded-full bg-coral" />
                    <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.15s" }} />
                    <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.3s" }} />
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* final deliverable */}
          {finalShown && (
            <div className="animate-rise mt-4 rounded-2xl border-2 border-coral/30 bg-cream p-4 shadow-[0_8px_30px_rgba(217,119,87,0.1)] dark:bg-night-surface/40">
              <Markdown text={finalShown} />
              {artifact && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-coral-soft px-3 py-2 text-[12px] font-medium text-coral-hover dark:bg-coral/15">
                  <ClaudeLogo size={14} /> Live build ready in the preview panel →
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* stop / status bar */}
      <div className="border-t border-line px-4 py-3 dark:border-night-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
          {busy ? (
            <button
              onClick={onStop}
              className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-cream transition hover:opacity-80 dark:bg-cream dark:text-ink"
            >
              <StopIcon size={15} /> Stop orchestrating
            </button>
          ) : (
            <span className="text-[12px] text-muted">
              {MASTER.name} finished · {log.length} agents contributed
            </span>
          )}
        </div>
      </div>
    </>
  );
}
