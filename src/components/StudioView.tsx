import { useState } from "react";
import { useStore } from "../lib/store";
import { hasProxy } from "../lib/realai";
import { MenuIcon, SparkleIcon } from "./icons";
import { cn } from "../utils/cn";

const MODELS = [
  { id: "svd", name: "Stable Video Diffusion" },
  { id: "cogvideox", name: "CogVideoX" },
];

export function StudioView({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { mediaKey, setMediaKey } = useStore();
  const [image, setImage] = useState(
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=512"
  );
  const [prompt, setPrompt] = useState("cinematic slow zoom, dramatic lighting");
  const [model, setModel] = useState("svd");
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setVideo(null);
    setStatus("Generating video… this can take ~30–90s.");
    try {
      const proxy = await hasProxy();
      if (!proxy) {
        setStatus("⚠️ Video generation needs the serverless proxy — deploy on Vercel to use it.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: mediaKey,
          endpoint: "https://modelslab.com/api/v6/video/img2video",
          init_image: image,
          prompt,
          model_id: model,
          height: 512,
          width: 512,
          num_frames: 16,
          output_type: "mp4",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`✗ ${data?.error || "Generation failed."}`);
      } else if (data?.video) {
        setVideo(data.video);
        setStatus("✓ Done!");
      } else {
        setStatus(data?.message || "Still processing — try again shortly.");
      }
    } catch (e) {
      setStatus(`✗ ${e instanceof Error ? e.message : "Network error."}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-cream dark:bg-night">
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <button
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream-deep lg:hidden dark:text-cream"
        >
          <MenuIcon size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral text-white">
            <SparkleIcon size={16} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-ink dark:text-cream">
              Video Studio
            </div>
            <div className="hidden text-[11px] text-muted sm:block">
              ModelsLab · image → video
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-1 sm:px-6">
          <div className="animate-fade mb-4 rounded-2xl border border-coral/30 bg-coral-soft/50 p-3 text-[12.5px] leading-relaxed text-ink-soft dark:bg-coral/10 dark:text-cream/85">
            Give an image URL + a motion prompt → get a short MP4 via ModelsLab.
            Runs through the Vercel serverless proxy, so <b>deploy on Vercel</b>{" "}
            first.
          </div>

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            ModelsLab API key
          </label>
          <input
            type="password"
            value={mediaKey}
            onChange={(e) => setMediaKey(e.target.value)}
            placeholder="ModelsLab key"
            className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 font-mono text-[12.5px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Source image URL
          </label>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…/photo.jpg"
            className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Motion prompt
          </label>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="describe the motion"
            className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mb-4 w-full rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {image && (
            <img
              src={image}
              alt="source"
              className="mb-4 h-44 w-full rounded-xl border border-line object-cover dark:border-night-surface"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
            />
          )}

          <button
            onClick={generate}
            disabled={busy || !image || !mediaKey}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition",
              !busy && image && mediaKey
                ? "bg-coral text-white hover:bg-coral-hover"
                : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
            )}
          >
            {busy ? (
              <>
                <span className="h-2 w-2 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
                Generating…
              </>
            ) : (
              "Generate video"
            )}
          </button>

          {status && (
            <div className="mt-3 rounded-lg bg-cream-deep px-3 py-2 text-[12.5px] text-ink-soft dark:bg-night-surface dark:text-cream/85">
              {status}
            </div>
          )}

          {video && (
            <div className="animate-rise mt-4 overflow-hidden rounded-2xl border border-line dark:border-night-surface">
              <video src={video} controls autoPlay loop className="w-full" />
              <a
                href={video}
                target="_blank"
                rel="noreferrer"
                className="block bg-cream px-3 py-2 text-center text-[12px] font-medium text-coral hover:underline dark:bg-night"
              >
                Open / download MP4 ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
