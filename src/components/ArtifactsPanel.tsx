import { useMemo, useState } from "react";
import { CloseIcon, CopyIcon, CheckIcon, FileIcon, GlobeIcon, SparkleIcon } from "./icons";
import { cn } from "../utils/cn";

export interface Artifact {
  id: string;
  title: string;
  lang: string;
  code: string;
}

const PREVIEWABLE = ["html", "xml", "svg"];

function canPreview(lang: string) {
  return PREVIEWABLE.includes(lang.toLowerCase());
}

function LineNumbers({ code }: { code: string }) {
  const count = code.split("\n").length;
  return (
    <div className="select-none bg-[#191917] py-3 pl-3 pr-2 text-right font-mono text-[11px] leading-[1.55] text-white/20">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

function CodeView({ code }: { code: string }) {
  return (
    <div className="flex h-full overflow-auto bg-[#1d1d1b]">
      <LineNumbers code={code} />
      <pre className="flex-1 overflow-x-auto py-3 pr-4 font-mono text-[12px] leading-[1.55] text-[#e8e6e0]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Mode = "preview" | "split" | "code";

// 🔒 FIX: Ye pehle ArtifactsPanel ke ANDAR define tha — har render par
// naya component type banta tha (react-hooks/static-components error,
// state remount bugs). Ab top-level hai.
function Seg({
  id,
  icon: Icon,
  label,
  mode,
  onSelect,
}: {
  id: Mode;
  icon: typeof GlobeIcon;
  label: string;
  mode: Mode;
  onSelect: (m: Mode) => void;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition",
        mode === id
          ? "bg-cream-deep text-ink dark:bg-night-surface dark:text-cream"
          : "text-muted hover:text-ink-soft dark:hover:text-cream"
      )}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

export function ArtifactsPanel({
  artifact,
  onClose,
  className,
}: {
  artifact: Artifact;
  onClose: () => void;
  className?: string;
}) {
  const preview = canPreview(artifact.lang);
  const [mode, setMode] = useState<Mode>(preview ? "split" : "code");
  const [copied, setCopied] = useState(false);

  const srcDoc = useMemo(
    () => (preview ? artifact.code : ""),
    [preview, artifact]
  );

  const copy = () => {
    navigator.clipboard?.writeText(artifact.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  const openTab = () => {
    // 🔒 Pehle blob URL se khulta tha (same-origin = app ke data tak
    // access). Ab content sessionStorage me dal kar sandboxed preview
    // page khulta hai — naya tab sessionStorage inherit karta hai, aur
    // wahan iframe `sandbox` (bina allow-same-origin) me render hota hai.
    try {
      sessionStorage.setItem("nexora-artifact", artifact.code);
    } catch {
      /* quota — openTab silently skip */
    }
    window.open("/artifact-preview", "_blank");
  };

  return (
    <div
      className={cn(
        "animate-fade flex h-full w-full flex-col border-l border-line bg-cream dark:border-night-surface dark:bg-night",
        className
      )}
    >
      {/* header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 dark:border-night-surface">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-coral/15 text-coral">
          <SparkleIcon size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink dark:text-cream">
          {artifact.title}
        </span>
        {preview && (
          <button
            onClick={openTab}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream"
            title="Open in new tab"
          >
            Open ↗
          </button>
        )}
        <button
          onClick={copy}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-2 transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream"
          title="Copy code"
        >
          {copied ? (
            <CheckIcon size={14} className="text-emerald-600" />
          ) : (
            <CopyIcon size={14} />
          )}
        </button>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-2 transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream"
          title="Close"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/* toolbar */}
      {preview && (
        <div className="flex items-center gap-1 border-b border-line px-2 py-1.5 dark:border-night-surface">
          <Seg id="preview" icon={GlobeIcon} label="Preview" mode={mode} onSelect={setMode} />
          <Seg id="split" icon={SparkleIcon} label="Split" mode={mode} onSelect={setMode} />
          <Seg id="code" icon={FileIcon} label="Code" mode={mode} onSelect={setMode} />
        </div>
      )}

      {/* body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!preview ? (
          <CodeView code={artifact.code} />
        ) : mode === "split" ? (
          <>
            <div className="min-h-0 flex-[1.1] border-b border-line dark:border-night-surface">
              <iframe
                title="preview"
                srcDoc={srcDoc}
                className="h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-modals"
              />
            </div>
            <div className="flex min-h-0 flex-1 items-center gap-2 border-b border-line bg-cream px-3 py-1.5 text-[11px] font-medium text-muted dark:border-night-surface dark:bg-night">
              <FileIcon size={12} /> {artifact.title}
              <span className="ml-auto rounded bg-cream-deep px-1.5 py-0.5 text-[10px] uppercase dark:bg-night-surface">
                {artifact.lang}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CodeView code={artifact.code} />
            </div>
          </>
        ) : mode === "preview" ? (
          <iframe
            title="preview"
            srcDoc={srcDoc}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-modals"
          />
        ) : (
          <CodeView code={artifact.code} />
        )}
      </div>

      <div className="border-t border-line px-3 py-1.5 text-[11px] text-muted-2 dark:border-night-surface">
        {preview
          ? "✦ Live preview — rendered securely in a sandbox. Edit the prompt to rebuild."
          : `Source · ${artifact.lang}`}
      </div>
    </div>
  );
}
