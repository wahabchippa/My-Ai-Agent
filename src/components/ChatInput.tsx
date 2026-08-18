import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ModelId } from "../lib/models";
import {
  ArrowUp,
  StopIcon,
  Paperclip,
  MicIcon,
} from "./icons";
import { useSpeechToText } from "../lib/voice";
import { cn } from "../utils/cn";

export function ChatInput({
  onSend,
  onStop,
  streaming,
  placeholder = "How can I help you today?",
  compact = false,
  prefill,
  onPrefillUsed,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming: boolean;
  model?: ModelId;
  onModelChange?: (m: ModelId) => void;
  placeholder?: string;
  compact?: boolean;
  web?: boolean;
  onWebChange?: (b: boolean) => void;
  /** pencil se wapas input me */
  prefill?: string | null;
  onPrefillUsed?: () => void;
}) {
  const [value, setValue] = useState("");
  const [seenPrefill, setSeenPrefill] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // props se state — effect nahi, React 19 render-time adjust
  if (prefill && prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    setValue(prefill);
  }

  const { supported: micSupported, listening, start: startMic, stop: stopMic } =
    useSpeechToText((text) => {
      setValue((v) => (v ? v + " " : "") + text);
      requestAnimationFrame(() => taRef.current?.focus());
    });

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    // PDFs and large files go to server-side parsing
    if (ext === "pdf") {
      setAttachment({ name: file.name, content: "" }); // show chip immediately
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-file", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (data?.text) {
        setAttachment({ name: file.name, content: data.text });
      } else {
        setAttachment({ name: file.name, content: data?.error || "Could not read PDF" });
      }
      return;
    }
    const textExts = [
      "txt", "md", "markdown", "csv", "json", "js", "jsx", "ts", "tsx", "py",
      "html", "css", "xml", "yaml", "yml", "java", "c", "cpp", "go", "rs",
      "rb", "php", "sh", "sql", "log", "doc", "docx",
    ];
    if (textExts.includes(ext) || file.type.startsWith("text/")) {
      const content = await file.text();
      setAttachment({ name: file.name, content: content.slice(0, 20000) });
    } else {
      setAttachment({ name: file.name, content: "" });
    }
  };

  // autosize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [value]);

  const submit = () => {
    let text = value.trim();
    if (!text || streaming) return;
    if (attachment) {
      text =
        (attachment.content
          ? `Attached file: ${attachment.name}\n\`\`\`\n${attachment.content}\n\`\`\`\n\n`
          : `Attached file: ${attachment.name} (binary — content not readable)\n\n`) +
        text;
      setAttachment(null);
    }
    onSend(text);
    setValue("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-[26px] border bg-cream shadow-[0_2px_14px_rgba(60,50,30,0.07)] transition focus-within:border-coral/50 focus-within:shadow-[0_4px_22px_rgba(217,119,87,0.14)] dark:bg-night",
        streaming
          ? "border-coral/40"
          : "border-line dark:border-night-surface"
      )}
    >
      {attachment && (
        <div className="flex items-center gap-2 px-5 pt-3">
          <span className="flex items-center gap-1.5 rounded-lg bg-cream-deep px-2.5 py-1 text-[12px] font-medium text-ink-soft dark:bg-night-surface dark:text-cream">
            <Paperclip size={13} className="text-coral" />
            <span className="max-w-[180px] truncate">{attachment.name}</span>
            <button
              onClick={() => setAttachment(null)}
              className="ml-1 text-muted hover:text-ink dark:hover:text-cream"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        className={cn(
          "block max-h-[220px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:outline-none dark:text-cream",
          compact ? "pb-1" : "pb-2"
        )}
      />

      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream",
              attachment && "text-coral"
            )}
            title="Attach a file (txt, code, csv, md, json…)"
          >
            <Paperclip size={17} />
          </button>
          {micSupported && (
            <button
              onClick={listening ? stopMic : startMic}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                listening
                  ? "bg-red-500/15 text-red-500 animate-pulse"
                  : "text-muted hover:bg-cream-deep hover:text-ink-soft dark:hover:bg-night-surface dark:hover:text-cream"
              )}
              title={listening ? "Stop listening" : "Speak your question"}
            >
              <MicIcon size={17} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {streaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream transition hover:opacity-80 dark:bg-cream dark:text-ink"
              title="Stop generating"
            >
              <StopIcon size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim()}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                value.trim()
                  ? "bg-coral text-white hover:bg-coral-hover"
                  : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
              )}
              title="Send"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
