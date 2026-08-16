"use client";

// ═══════════════════════════════════════════════════════════════════════
// NEXORA WORKSPACE — AI PROJECT BUILDER
//
// PURANA WORKSPACE KYA THA:
// `src/lib/builder.ts` par chalta tha jis me EK BHI AI call nahi thi.
// Sirf keyword matching:
//     "calculator" -> canned calculator HTML
//     "todo"       -> canned todo HTML
//     warna        -> generic "website about <topic>"
// Yani "expense tracker with charts" maango to bhi wohi generic landing
// page milta tha. Ek file, hamesha wohi, AI ka koi dakhal nahi.
//
// AB:
// POST /api/build asal models se poora project banata hai — 3 se 7 files,
// folder structure, README — jo yahan file tree me khulti hain, edit hoti
// hain, live preview me chalti hain, aur ZIP me download hoti hain.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadZip } from "../lib/zip";
import { cn } from "../utils/cn";
import { MenuIcon, ArrowUp, CheckIcon, CopyIcon, SparkleIcon, StopIcon } from "./icons";

interface Props {
  onOpenSidebar?: () => void;
}

interface ProjectFile {
  path: string;
  content: string;
  lang: string;
}

interface Project {
  name: string;
  summary: string;
  stack: string;
  files: ProjectFile[];
  built: number;
  total: number;
  ms: number;
}

const LS_KEY = "nexora-workspace-v1";

const EXAMPLES = [
  "Expense tracker with categories and a pie chart",
  "Pomodoro timer with session history",
  "Markdown notes app with live preview",
  "Python CLI that renames files by EXIF date",
];

/** Preview ke liye HTML + CSS + JS ko ek document me jorh do. Alag files
 *  iframe me relative src se load nahi hongi (koi server nahi hai), is
 *  liye inline karna parta hai. */
function buildPreview(files: ProjectFile[]): string | null {
  const html = files.find((f) => /\.html?$/i.test(f.path));
  if (!html) return null;
  let out = html.content;

  for (const f of files) {
    if (/\.css$/i.test(f.path)) {
      const tag = new RegExp(`<link[^>]*href=["']\\.?/?${f.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
      out = out.replace(tag, `<style>\n${f.content}\n</style>`);
    }
    if (/\.m?js$/i.test(f.path)) {
      const tag = new RegExp(`<script[^>]*src=["']\\.?/?${f.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*></script>`, "i");
      out = out.replace(tag, `<script>\n${f.content}\n</script>`);
    }
  }
  return out;
}

export function WorkspaceView({ onOpenSidebar }: Props) {
  const [prompt, setPrompt] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [activePath, setActivePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);
  // Workspace ka chat: project ban jane ke baad usay badalne ke liye.
  // Pehle project ban kar pathar par likha ho jata tha — badalna ho to
  // poora dobara banwao. Ab "button green karo" kehna kaafi hai.
  const [chat, setChat] = useState<{ role: "user" | "ai"; text: string; changed?: string[] }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef(0);

  // Pichla project wapas lao — refresh par 25 second ka kaam zaya na ho.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Project;
        if (p?.files?.length) {
          setProject(p);
          setActivePath(p.files[0].path);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(project));
    } catch {}
  }, [project]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy]);

  const active = project?.files.find((f) => f.path === activePath) ?? null;
  const preview = useMemo(() => (project ? buildPreview(project.files) : null), [project]);

  const generate = async () => {
    const t = prompt.trim();
    if (!t || busy) return;
    setError("");
    setBusy(true);
    startRef.current = Date.now();
    setElapsed(0);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: t }),
        signal: ac.signal,
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.message || d.error || "Project nahi ban saka");
        return;
      }
      setProject(d as Project);
      setChat([]);
      setActivePath(d.files[0]?.path ?? "");
      setTab(d.files.some((f: ProjectFile) => /\.html?$/i.test(f.path)) ? "preview" : "code");
      setPrompt("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  /** Chat se project badlo — sirf mutasira files dobara likhi jati hain. */
  const sendEdit = async (text: string) => {
    const t = text.trim();
    if (!t || !project || busy) return;
    setChat((c) => [...c, { role: "user", text: t }]);
    setPrompt("");
    setError("");
    setBusy(true);
    startRef.current = Date.now();
    setElapsed(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/build/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, files: project.files }),
        signal: ac.signal,
      });
      const d = await res.json();
      if (d.files?.length) {
        setProject({ ...project, files: d.files, built: d.files.length, total: d.files.length });
        // Jo file abhi badli hai wohi khol do — user ko farq foran dikhe.
        if (d.changed?.length) setActivePath(d.changed[0]);
      }
      setChat((c) => [...c, { role: "ai", text: d.reply || (d.ok ? "Ho gaya." : "Nahi ho saka."), changed: d.changed ?? [] }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setChat((c) => [...c, { role: "ai", text: "Network masla — dobara koshish karein." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const editActive = (content: string) => {
    if (!project || !active) return;
    setProject({
      ...project,
      files: project.files.map((f) => (f.path === active.path ? { ...f, content } : f)),
    });
  };

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
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink dark:text-cream">
            {project ? project.name : "Workspace"}
            {project && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                {project.built}/{project.total} files
              </span>
            )}
          </div>
          <div className="truncate text-[11.5px] text-muted">
            {project ? project.stack : "Describe a project — the AI writes every file"}
          </div>
        </div>
        {project && (
          <button
            onClick={() => downloadZip(project.name, project.files.map((f) => ({ path: f.path, content: f.content })))}
            className="rounded-lg bg-coral px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-coral-hover"
          >
            ↓ .zip
          </button>
        )}
      </div>

      {/* prompt bar */}
      <div className="border-b border-line px-4 py-3 dark:border-night-surface">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-cream px-3 py-2 focus-within:border-coral/50 dark:border-night-surface dark:bg-night-surface/40">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                project ? sendEdit(prompt) : generate();
              }
            }}
            rows={1}
            disabled={busy}
            placeholder={project ? "Ab kya badalna hai? e.g. dark mode add karo…" : "Build an expense tracker with charts…"}
            className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none disabled:opacity-50 dark:text-cream"
          />
          <button
            onClick={busy ? () => abortRef.current?.abort() : project ? () => sendEdit(prompt) : generate}
            disabled={!busy && !prompt.trim()}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition",
              busy
                ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                : prompt.trim()
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
        {!project && !busy && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink-soft transition hover:border-coral/40 hover:text-coral dark:border-night-surface dark:text-cream/70"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {error && <div className="mt-2 text-[12px] text-rose-500">{error}</div>}
      </div>

      {/* body */}
      {!project ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-coral-hover text-[28px] shadow-[0_10px_30px_rgba(217,119,87,0.35)]">
            🛠️
          </div>
          <div className="text-[15px] font-semibold text-ink dark:text-cream">
            {busy ? `Building… ${elapsed}s` : "Nothing built yet"}
          </div>
          <p className="mt-1 max-w-sm text-[12.5px] text-muted">
            {busy
              ? "Planning the file structure, then writing each file."
              : "Describe a project above. You get real files — not one snippet — ready to download and run."}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* file tree */}
          <div className="w-48 shrink-0 overflow-y-auto border-r border-line py-2 dark:border-night-surface">
            {project.files.map((f) => (
              <button
                key={f.path}
                onClick={() => {
                  setActivePath(f.path);
                  setTab("code");
                }}
                className={cn(
                  "block w-full truncate px-3 py-1.5 text-left font-mono text-[11.5px] transition",
                  f.path === activePath && tab === "code"
                    ? "bg-coral-soft text-coral-hover dark:bg-coral/15"
                    : "text-ink-soft hover:bg-cream-deep dark:text-cream/70 dark:hover:bg-night-surface/60",
                )}
              >
                {f.path}
              </button>
            ))}
            {preview && (
              <button
                onClick={() => setTab("preview")}
                className={cn(
                  "mt-2 block w-full border-t border-line px-3 py-2 text-left text-[11.5px] font-medium transition dark:border-night-surface",
                  tab === "preview"
                    ? "bg-coral-soft text-coral-hover dark:bg-coral/15"
                    : "text-ink-soft hover:bg-cream-deep dark:text-cream/70 dark:hover:bg-night-surface/60",
                )}
              >
                <SparkleIcon size={11} /> Live preview
              </button>
            )}
          </div>

          {/* chat — project ke sath baat karo */}
          {chat.length > 0 && (
            <div className="flex w-64 shrink-0 flex-col border-r border-line dark:border-night-surface">
              <div className="border-b border-line px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted dark:border-night-surface">
                Changes
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed",
                      m.role === "user"
                        ? "bg-coral-soft text-coral-hover dark:bg-coral/15"
                        : "bg-cream-deep/60 text-ink-soft dark:bg-night-surface/50 dark:text-cream/75",
                    )}
                  >
                    {m.text}
                    {!!m.changed?.length && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.changed.map((f) => (
                          <button
                            key={f}
                            onClick={() => {
                              setActivePath(f);
                              setTab("code");
                            }}
                            className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-1.5 px-2 text-[11px] text-muted">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" />
                    working… {elapsed}s
                  </div>
                )}
              </div>
            </div>
          )}

          {/* editor / preview */}
          <div className="flex min-w-0 flex-1 flex-col">
            {tab === "preview" && preview ? (
              <iframe
                title="preview"
                srcDoc={preview}
                sandbox="allow-scripts"
                className="h-full w-full border-0 bg-white"
              />
            ) : active ? (
              <>
                <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 dark:border-night-surface">
                  <span className="font-mono text-[11px] text-muted">{active.path}</span>
                  <span className="text-[10.5px] text-muted-2">{active.content.length} chars</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(active.content).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      });
                    }}
                    className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted transition hover:bg-cream-deep hover:text-coral dark:hover:bg-night-surface"
                  >
                    {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
                <textarea
                  value={active.content}
                  onChange={(e) => editActive(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-ink focus:outline-none dark:text-cream/90"
                />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
