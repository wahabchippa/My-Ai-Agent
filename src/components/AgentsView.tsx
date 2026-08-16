import { useEffect, useRef, useState, type RefObject } from "react";
import {
  SPECIALISTS,
  classifyTask,
  selectTeam,
  type SpecialistId,
} from "../lib/agentPrompts";
import { Markdown } from "../lib/markdown";
import { ArtifactsPanel, type Artifact } from "./ArtifactsPanel";
import { newId } from "../lib/store";
import { ClaudeLogo, MenuIcon, ArrowUp, StopIcon, CheckIcon, SparkleIcon } from "./icons";
import { cn } from "../utils/cn";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const MASTER = {
  name: "Atlas",
  role: "Master Orchestrator",
  emoji: "🧠",
  color: "#D97757",
};

type Phase = "idle" | "planning" | "running" | "synthesizing" | "done";

/** Ek agent ne jo kaam kiya (server se aata hai). */
interface Stage {
  id: SpecialistId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  model: string;
  provider: string;
  output: string;
  ok: boolean;
  error?: string;
  ms: number;
}

interface TeamMember {
  id: SpecialistId;
  name: string;
  role: string;
  emoji: string;
  color: string;
}

const PLAN_FOR: Record<string, string[]> = {
  build: ["Requirements samjho", "Code likho", "Review karo", "Tests banao"],
  review: ["Code parho", "Bugs & security check karo", "Tests tajweez karo"],
  research: ["Web se live maloomat lo", "Sources ka tajziya karo", "Brief tayyar karo"],
  write: ["Audience & tone tay karo", "Draft likho", "Polish karo"],
  data: ["Data samjho", "Tajziya + numbers", "Natayij & sifarishat"],
  general: ["Sawal samjho", "Maloomat jama karo", "Jawab tayyar karo"],
};

const EXAMPLES = [
  "Build a todo app and test it",
  "Research black holes and write a short report",
  "Create a website for a coffee brand",
  "Analyze the pros and cons of remote work",
];

export function AgentsView({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<string>("general");
  const [plan, setPlan] = useState<string[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [log, setLog] = useState<Stage[]>([]);
  const [current, setCurrent] = useState<SpecialistId | null>(null);
  const [currentModel, setCurrentModel] = useState("");
  const [done, setDone] = useState<Set<SpecialistId>>(new Set());
  const [finalShown, setFinalShown] = useState("");
  const [synthBy, setSynthBy] = useState("");
  const [researchChars, setResearchChars] = useState(0);
  const [redacted, setRedacted] = useState<string[] | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  // Pichli guftagu. Backend ab messages[] parhta hai, magar frontend sirf
  // { task } bhejta tha — is liye har run "pehla run" ban jata tha aur
  // follow-up ("ab isko Python me karo") ka matlab kho jata tha.
  const [convo, setConvo] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [log, current, finalShown]);

  // Jab component band ho to chalti hui request bhi cancel karo.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Final markdown me sab se bara code block dhoond kar artifact banao. */
  const extractArtifact = (md: string): Artifact | null => {
    const blocks = [...md.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
    if (!blocks.length) return null;
    const best = blocks.reduce((a, b) => (b[2].length > a[2].length ? b : a));
    if (best[2].trim().length < 200) return null;
    const lang = (best[1] || "text").toLowerCase();
    return {
      id: newId(),
      title: lang === "html" ? "Live preview" : `main.${lang}`,
      lang,
      code: best[2].trim(),
    };
  };

  const run = async (taskText: string) => {
    const text = taskText.trim();
    if (!text) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Server bhi khud classify karta hai, magar UI ko turant plan dikhana hai
    // (warna pehle response tak screen khaali rehti hai). Server ka faisla
    // aate hi ye overwrite ho jata hai.
    const guess = classifyTask(text);
    setSubject(text);
    setKind(guess);
    setPlan(PLAN_FOR[guess] ?? PLAN_FOR.general);
    setTeam(
      selectTeam(guess)
        .map((id) => SPECIALISTS.find((s) => s.id === id)!)
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, role: s.role, emoji: s.emoji, color: s.color }))
    );
    setLog([]);
    setDone(new Set());
    setCurrent(null);
    setCurrentModel("");
    setFinalShown("");
    setSynthBy("");
    setResearchChars(0);
    setRedacted(null);
    setErrMsg("");
    setArtifact(null);
    setPhase("planning");

    try {
      const res = await fetch("/api/agents?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: text,
          // aakhri 6 turns — server bhi 6 par cap karta hai
          messages: [...convo, { role: "user" as const, content: text }].slice(-7),
        }),
        signal: ac.signal,
      });

      if (!res.ok && !res.body) {
        const j = await res.json().catch(() => null);
        setErrMsg(j?.message || `Server error ${res.status}`);
        setPhase("done");
        return;
      }

      // NDJSON stream — har line ek event.
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
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

          switch (ev.type) {
            case "plan": {
              const t = ev.team as TeamMember[];
              setKind(ev.kind as string);
              setPlan(PLAN_FOR[ev.kind as string] ?? PLAN_FOR.general);
              setTeam(t);
              setRedacted((ev.redacted as string[] | null) ?? null);
              setPhase("running");
              break;
            }
            case "research":
              setResearchChars(ev.chars as number);
              break;
            case "agent:start":
              setCurrent(ev.id as SpecialistId);
              setCurrentModel(ev.model as string);
              break;
            case "agent:done": {
              const st = ev.stage as Stage;
              setLog((prev) => [...prev, st]);
              setDone((prev) => new Set(prev).add(st.id));
              setCurrent(null);
              break;
            }
            case "synthesis:start":
              setPhase("synthesizing");
              break;
            case "done": {
              const md = ev.final as string;
              setSynthBy(ev.synthesizedBy as string);
              setArtifact(extractArtifact(md));
              // guftagu yaad rakho — agle run me context ke tor par jayegi
              setConvo((prev) =>
                [...prev, { role: "user" as const, content: text }, { role: "assistant" as const, content: md }].slice(-6),
              );
              // Halka sa stream taake jawab "aata hua" mehsoos ho.
              const tokens = md.match(/\s+|\S+/g) ?? [md];
              const chunk = Math.max(1, Math.ceil(tokens.length / 50));
              let acc = "";
              for (let i = 0; i < tokens.length; i += chunk) {
                if (ac.signal.aborted) break;
                acc += tokens.slice(i, i + chunk).join("");
                setFinalShown(acc);
                await delay(14);
              }
              setFinalShown(md);
              setPhase("done");
              break;
            }
            case "error":
              setErrMsg(ev.message as string);
              setPhase("done");
              break;
          }
        }
      }
      setPhase((p) => (p === "done" ? p : "done"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErrMsg(e instanceof Error ? e.message : "Network error");
      }
      setPhase("done");
    } finally {
      setCurrent(null);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setPhase("done");
  };

  /**
   * Screen saaf karo magar guftagu YAAD rakho — taake user agla sawal
   * pichle jawab ke hawale se pooch sake ("ab isko Python me karo").
   * Context bhoolne ke liye alag button hai.
   */
  const reset = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setSubject("");
    setPlan([]);
    setTeam([]);
    setLog([]);
    setDone(new Set());
    setCurrent(null);
    setFinalShown("");
    setErrMsg("");
    setArtifact(null);
  };

  /** Poori shuruaat — guftagu bhi bhool jao. */
  const clearContext = () => {
    reset();
    setConvo([]);
  };

  const busy = phase === "planning" || phase === "running" || phase === "synthesizing";

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
          <div className="ml-auto flex items-center gap-2">
            {convo.length > 0 && (
              <>
                {/* Batao ke agent pichli baat yaad rakhe hue hai — warna user
                    ko pata hi nahi chalega ke follow-up mumkin hai. */}
                <span
                  className="rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-medium text-ink-soft dark:bg-night-surface dark:text-cream/70"
                  title="Agent pichli guftagu yaad rakhta hai — follow-up sawal pooch sakte hain"
                >
                  💬 {convo.length / 2} turn{convo.length / 2 > 1 ? "s" : ""} yaad
                </span>
                <button
                  onClick={clearContext}
                  className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-cream-deep dark:border-night-surface dark:text-cream"
                  title="Guftagu bhool kar bilkul naye sire se shuru karo"
                >
                  Clear context
                </button>
              </>
            )}
            {phase !== "idle" && (
              <button
                onClick={reset}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-cream-deep dark:border-night-surface dark:text-cream"
              >
                New task
              </button>
            )}
          </div>
        </header>

        {phase === "idle" ? (
          <IdleHome onRun={run} examples={EXAMPLES} />
        ) : (
          <RunningView
            subject={subject}
            kind={kind}
            plan={plan}
            team={team}
            phase={phase}
            log={log}
            current={current}
            currentModel={currentModel}
            done={done}
            finalShown={finalShown}
            synthBy={synthBy}
            researchChars={researchChars}
            redacted={redacted}
            errMsg={errMsg}
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
          {SPECIALISTS.map((a) => (
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
  id: SpecialistId,
  team: TeamMember[],
  current: SpecialistId | null,
  done: Set<SpecialistId>
): "standby" | "queued" | "working" | "done" {
  if (done.has(id)) return "done";
  if (current === id) return "working";
  if (team.some((t) => t.id === id)) return "queued";
  return "standby";
}

function Dots() {
  return (
    <span className="flex gap-1">
      <span className="dot h-1.5 w-1.5 rounded-full bg-coral" />
      <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.15s" }} />
      <span className="dot h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: "0.3s" }} />
    </span>
  );
}

function RunningView({
  subject,
  kind,
  plan,
  team,
  phase,
  log,
  current,
  currentModel,
  done,
  finalShown,
  synthBy,
  researchChars,
  redacted,
  errMsg,
  busy,
  logRef,
  artifact,
  onStop,
}: {
  subject: string;
  kind: string;
  plan: string[];
  team: TeamMember[];
  phase: Phase;
  log: Stage[];
  current: SpecialistId | null;
  currentModel: string;
  done: Set<SpecialistId>;
  finalShown: string;
  synthBy: string;
  researchChars: number;
  redacted: string[] | null;
  errMsg: string;
  busy: boolean;
  logRef: RefObject<HTMLDivElement | null>;
  artifact: Artifact | null;
  onStop: () => void;
}) {
  const currentSpec = current ? SPECIALISTS.find((s) => s.id === current) : null;

  return (
    <>
      <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-1 sm:px-6">
          {/* task brief */}
          <div className="animate-rise mb-4 rounded-2xl border border-line bg-cream-surface/60 p-4 dark:border-night-surface dark:bg-night-surface/40">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <SparkleIcon size={13} /> Task
              <span className="rounded bg-coral/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-coral">
                {kind}
              </span>
            </div>
            <div className="text-[15px] font-medium text-ink dark:text-cream">{subject}</div>
            {(redacted?.length || researchChars > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {redacted?.length ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    🔒 redacted: {redacted.join(", ")}
                  </span>
                ) : null}
                {researchChars > 0 && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10.5px] font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
                    🌐 web research · {researchChars.toLocaleString()} chars
                  </span>
                )}
              </div>
            )}
          </div>

          {/* plan */}
          <div className="animate-rise mb-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink dark:text-cream">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-[12px] text-white">
                {MASTER.emoji}
              </span>
              {MASTER.name}&apos;s plan
            </div>
            <ol className="space-y-1.5 pl-1">
              {plan.map((step, i) => {
                const stepDone = i < log.length || phase === "done";
                return (
                  <li key={i} className="flex gap-2.5 text-[14px] text-ink-soft dark:text-cream/80">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        stepDone ? "bg-coral/15 text-coral" : "bg-cream-deep text-muted dark:bg-night-surface"
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
          <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {SPECIALISTS.map((a) => {
              const st = agentStatus(a.id, team, current, done);
              return (
                <div
                  key={a.id}
                  title={`${a.name} — ${a.blurb}`}
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
                  <span className="text-[11px] font-medium text-ink dark:text-cream">{a.name}</span>
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      st === "done" ? "text-emerald-600" : st === "working" ? "text-coral" : "text-muted-2"
                    )}
                  >
                    {st === "standby" ? "standby" : st}
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
                Analyzing the task and assembling the team <Dots />
              </span>
            </div>
          )}

          {/* activity timeline */}
          <div className="space-y-3">
            {log.map((stage, i) => (
              <div key={i} className="animate-rise flex gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ backgroundColor: stage.color + "22" }}
                >
                  {stage.emoji}
                </span>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-2xl border p-3.5",
                    stage.ok
                      ? "border-line bg-cream dark:border-night-surface dark:bg-night-surface/40"
                      : "border-red-300/50 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5"
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink dark:text-cream">{stage.name}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ backgroundColor: stage.color + "22", color: stage.color }}
                    >
                      {stage.role}
                    </span>
                    <span className="text-[11px] text-muted-2">
                      · {stage.model} · {(stage.ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {stage.ok ? (
                    <Markdown text={stage.output} />
                  ) : (
                    <div className="text-[13px] text-red-700 dark:text-red-300">
                      Ye agent nahi chal saka — {stage.error ?? "unknown error"}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* current working indicator */}
            {busy && currentSpec && (
              <div className="animate-fade flex items-center gap-3 pl-1 text-[13px] text-muted">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[16px]"
                  style={{ backgroundColor: currentSpec.color + "22" }}
                >
                  {currentSpec.emoji}
                </span>
                <span className="flex items-center gap-1.5">
                  {currentSpec.name} is working
                  {currentModel && <span className="text-muted-2">· {currentModel}</span>}
                  <Dots />
                </span>
              </div>
            )}

            {phase === "synthesizing" && (
              <div className="animate-fade flex items-center gap-3 pl-1 text-[13px] text-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/15 text-[16px]">
                  {MASTER.emoji}
                </span>
                <span className="flex items-center gap-1.5">
                  {MASTER.name} sab ka kaam mila kar final jawab bana raha hai <Dots />
                </span>
              </div>
            )}
          </div>

          {errMsg && (
            <div className="animate-rise mt-4 rounded-2xl border border-red-300/60 bg-red-50 p-4 text-[13.5px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <div className="mb-1 font-semibold">Kuch ghalat ho gaya</div>
              {errMsg}
            </div>
          )}

          {/* final deliverable */}
          {finalShown && (
            <div className="animate-rise mt-4 rounded-2xl border-2 border-coral/30 bg-cream p-4 shadow-[0_8px_30px_rgba(217,119,87,0.1)] dark:bg-night-surface/40">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-coral">
                <SparkleIcon size={13} /> Final deliverable
              </div>
              <Markdown text={finalShown} />
              {artifact && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-coral-soft px-3 py-2 text-[12px] font-medium text-coral-hover dark:bg-coral/15">
                  <ClaudeLogo size={14} /> Code ready in the panel →
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
              {MASTER.name} finished · {log.filter((l) => l.ok).length} agents contributed
              {synthBy && !synthBy.startsWith("none") && ` · synthesized by ${synthBy}`}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
