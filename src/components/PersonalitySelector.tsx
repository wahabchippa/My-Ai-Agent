import { useEffect, useRef, useState } from "react";
import { PERSONALITIES, getPersonality } from "../lib/personalities";
import type { PersonalityId } from "../lib/personalities";
import { CheckIcon } from "./icons";
import { cn } from "../utils/cn";

export function PersonalitySelector({
  personality,
  onChange,
  variant = "header",
}: {
  personality: PersonalityId;
  onChange: (p: PersonalityId) => void;
  variant?: "header" | "input";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getPersonality(personality);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg text-sm font-medium transition",
          variant === "input"
            ? "px-2.5 py-1.5 text-ink-soft hover:bg-cream-deep dark:text-cream/80 dark:hover:bg-night-surface"
            : "px-2.5 py-1.5 text-ink hover:bg-cream-deep dark:text-cream dark:hover:bg-night-surface"
        )}
        title={`${current.name} — ${current.brand}`}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md text-[12px]"
          style={{ backgroundColor: current.color + "22", color: current.color }}
        >
          {current.emoji}
        </span>
        <span className="hidden sm:inline">{current.name}</span>
      </button>

      {open && (
        <div className="animate-rise absolute left-0 top-full z-50 mt-1.5 w-[300px] origin-top-left overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_12px_44px_rgba(60,50,30,0.18)] dark:border-night-surface dark:bg-night">
          <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Talk to any AI
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {PERSONALITIES.map((p) => {
              const selected = p.id === personality;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    selected
                      ? "bg-coral-soft dark:bg-coral/15"
                      : "hover:bg-cream-deep dark:hover:bg-night-surface"
                  )}
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[16px]"
                    style={{ backgroundColor: p.color + "22", color: p.color }}
                  >
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink dark:text-cream">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-muted-2">{p.brand}</span>
                      {selected && (
                        <CheckIcon size={14} className="ml-auto text-coral" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {p.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-line px-3 py-2 text-[11px] text-muted dark:border-night-surface">
            ✦ Style simulation — same knowledge, different voice.
          </div>
        </div>
      )}
    </div>
  );
}
