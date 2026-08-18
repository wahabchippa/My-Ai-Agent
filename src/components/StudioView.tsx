"use client";

// Studio — naya chehra (Pollinations), photo edit + video (/api/media).
// Koi nayi API nahi.

import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import { cn } from "../utils/cn";
import { MenuIcon } from "./icons";

interface Props {
  onOpenSidebar?: () => void;
}

type Kind = "image" | "edit" | "video";
type Item = { id: string; kind: Kind; prompt: string; url: string; ts: number };

const LS = "nexora-studio-v1";

function loadItems(): Item[] {
  try {
    const raw = localStorage.getItem(LS);
    const a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function readFile(file: File): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ""));
    r.onerror = () => bad(new Error("file nahi padhi"));
    r.readAsDataURL(file);
  });
}

export function StudioView({ onOpenSidebar }: Props) {
  const { mediaKey, setMediaKey } = useStore();
  const [kind, setKind] = useState<Kind>("image");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [items, setItems] = useState<Item[]>(loadItems);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (next: Item[]) => {
    setItems(next);
    try {
      localStorage.setItem(LS, JSON.stringify(next.slice(0, 40)));
    } catch { /* quota */ }
  };

  const callLab = async (endpoint: string, extra: Record<string, unknown>) => {
    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: mediaKey.trim(),
        endpoint,
        prompt: prompt.trim(),
        ...extra,
      }),
    });
    const d = await res.json().catch(() => ({}));
    const url = (d.url || d.image || d.video) as string | undefined;
    if (!url) throw new Error(d.error || d.message || "Generation fail");
    return url;
  };

  const run = async () => {
    const t = prompt.trim();
    if (busy) return;
    if (kind !== "video" && !t) return;
    if ((kind === "edit" || (kind === "video" && photo)) && !photo) {
      setErr("Pehle photo upload karo.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      let url = "";
      if (kind === "image") {
        // naya face / scene — keyless
        url =
          `https://image.pollinations.ai/prompt/${encodeURIComponent(t)}` +
          `?model=flux&width=1024&height=1024&nologo=true&seed=${Date.now()}`;
        await new Promise<void>((ok, bad) => {
          const img = new Image();
          img.onload = () => ok();
          img.onerror = () => bad(new Error("Image nahi bani"));
          img.src = url;
        });
      } else if (kind === "edit") {
        // asli photo badlo — ModelsLab img2img (init_image pehle se API me)
        url = await callLab("https://modelslab.com/api/v6/realtime/img2img", {
          model_id: "flux",
          init_image: photo,
          width: 768,
          height: 768,
          output_type: "png",
        });
      } else if (photo) {
        url = await callLab("https://modelslab.com/api/v6/video/img2video", {
          model_id: "svd",
          init_image: photo,
          width: 512,
          height: 512,
          num_frames: 16,
          output_type: "mp4",
        });
      } else {
        if (!t) {
          setErr("Prompt likho ya photo daalo.");
          return;
        }
        url = await callLab("https://modelslab.com/api/v6/video/text2video", {
          model_id: "svd",
          width: 512,
          height: 512,
          num_frames: 16,
          output_type: "mp4",
        });
      }
      save([{ id: String(Date.now()), kind, prompt: t || "photo", url, ts: Date.now() }, ...items]);
      setPrompt("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation fail");
    } finally {
      setBusy(false);
    }
  };

  const needPhoto = kind === "edit" || kind === "video";

  return (
    <div className="flex h-full min-h-0 flex-col bg-cream dark:bg-night">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 dark:border-night-surface">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep md:hidden dark:hover:bg-night-surface"
        >
          <MenuIcon size={18} />
        </button>
        <div>
          <div className="text-[14px] font-semibold text-ink dark:text-cream">Studio</div>
          <div className="text-[11.5px] text-muted">Naya chehra · photo edit · video</div>
        </div>
        <div className="ml-auto flex rounded-full border border-line p-0.5 dark:border-night-surface">
          {([
            ["image", "🖼 Naya"],
            ["edit", "✏️ Edit"],
            ["video", "🎬 Video"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                kind === k ? "bg-coral text-white" : "text-muted hover:text-ink dark:hover:text-cream",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-line px-4 py-3 dark:border-night-surface">
        {needPhoto && (
          <div className="mb-2 flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition hover:border-coral/40 dark:border-night-surface dark:text-cream/80"
            >
              {photo ? "Photo badlo" : "Photo upload"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setPhoto(await readFile(f));
                  setErr("");
                } catch (er) {
                  setErr(er instanceof Error ? er.message : "upload fail");
                }
              }}
            />
            {photo && (
              <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover border border-line" />
            )}
            <span className="text-[11px] text-muted">
              {kind === "edit" ? "Chehra/kapray/background badalne ke liye asli photo." : "Photo se video — ya khali prompt se naya clip."}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-line bg-cream px-3 py-2 focus-within:border-coral/50 dark:border-night-surface dark:bg-night-surface/40">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            rows={2}
            disabled={busy}
            placeholder={
              kind === "image"
                ? "A photorealistic portrait of a woman in Karachi sunlight…"
                : kind === "edit"
                  ? "Same face, studio lighting, slight smile, 85mm photo…"
                  : "Slow push-in, cinematic, the person looks at camera…"
            }
            className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none disabled:opacity-50 dark:text-cream"
          />
          <button
            onClick={run}
            disabled={busy || (kind !== "video" && !prompt.trim())}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-[12.5px] font-medium transition",
              busy || (kind !== "video" && !prompt.trim())
                ? "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
                : "bg-coral text-white hover:bg-coral-hover",
            )}
          >
            {busy ? "Working…" : kind === "edit" ? "Edit" : "Generate"}
          </button>
        </div>

        {(kind === "edit" || kind === "video") && (
          <div className="mt-2">
            <label className="mb-1 block text-[11px] text-muted">
              ModelsLab key — Vercel pe MODELSLAB_API_KEY ho to khali chhod do
            </label>
            <input
              value={mediaKey}
              onChange={(e) => setMediaKey(e.target.value)}
              placeholder="modelslab.com API key"
              className="w-full rounded-lg border border-line bg-cream px-3 py-1.5 text-[12px] text-ink outline-none focus:border-coral dark:border-night-surface dark:bg-night dark:text-cream"
            />
          </div>
        )}
        {err && <div className="mt-2 text-[12px] text-rose-500">{err}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted">
            <div className="mb-2 text-4xl">🎨</div>
            <p className="text-[14px]">Naya chehra, photo edit, ya video.</p>
            <p className="mt-1 max-w-sm text-[12px]">
              Image free hai. Apni photo edit / video ke liye ModelsLab key (pehle se /api/media).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <figure
                key={it.id}
                className="overflow-hidden rounded-xl border border-line bg-cream-surface dark:border-night-surface dark:bg-night-surface"
              >
                {it.kind === "video" ? (
                  <video src={it.url} controls className="aspect-video w-full bg-black" />
                ) : (
                  <img src={it.url} alt={it.prompt} className="aspect-square w-full object-cover" />
                )}
                <figcaption className="line-clamp-2 px-3 py-2 text-[11.5px] text-muted">{it.prompt}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
