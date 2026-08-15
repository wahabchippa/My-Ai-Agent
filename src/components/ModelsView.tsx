import { useEffect, useState } from "react";
import { PROVIDERS, getProvider, testReal, explainError, browserOk, hasProxy, type Provider, type KeySlot } from "../lib/realai";
import { useStore } from "../lib/store";
import { MenuIcon, CheckIcon, CloseIcon, GlobeIcon, PlusIcon } from "./icons";
import { cn } from "../utils/cn";

export function ModelsView({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { apiKeys, activeSlot, setSlot, removeSlot, setActiveSlot } = useStore();
  const slots = Object.values(apiKeys);

  // Auto-test any saved-but-untested slots on open, so connection status shows
  // immediately (✓ connected / ✗ failed) without manual clicking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const proxy = await hasProxy(); // true when deployed on Vercel
      slots.forEach(async (slot) => {
        if (!slot.apiKey || slot.ok !== null) return;
        // Without a proxy, CORS-blocked providers can't run in the browser.
        if (!proxy && !browserOk(slot.provider)) {
          if (!cancelled)
            setSlot({
              ...slot,
              ok: false,
              error: `Browser (CORS) blocks ${getProvider(slot.provider).name}. Deploy on Vercel (with the serverless proxy) OR use Groq, Gemini, or OpenRouter instead.`,
            });
          return;
        }
        try {
          await testReal({ provider: slot.provider, apiKey: slot.apiKey, model: slot.model });
          if (!cancelled) setSlot({ ...slot, ok: true, error: null });
        } catch (e) {
          if (!cancelled) setSlot({ ...slot, ok: false, error: explainError(slot.provider, e) });
        }
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col bg-cream dark:bg-night">
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
            <GlobeIcon size={16} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-ink dark:text-cream">
              AI Models & Keys
            </div>
            <div className="hidden text-[11px] text-muted sm:block">
              {slots.length} key{slots.length !== 1 ? "s" : ""} · {PROVIDERS.length} providers ·
              tap a model to chat with it
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-1 sm:px-6">
          {/* explainer */}
          <div className="animate-fade mb-4 rounded-2xl border border-coral/30 bg-coral-soft/50 p-4 text-[13px] leading-relaxed text-ink-soft dark:bg-coral/10 dark:text-cream/85">
            <b>Nexora runs real models on the backend.</b> You don't need any key
            to chat — the server already holds an OpenRouter key, and your sidebar
            model (Ultra / Pro / Core / Flash) maps to a real model automatically.
            Want extra providers or your own limits? Add{" "}
            <b>your own</b> key below (tap <b>Add another API key</b>):
            <div className="mt-2 space-y-1">
              <div>
                🌐 <b>OpenRouter</b> (best) — one free key gives{" "}
                <b>hundreds of models</b> (GPT, Gemini, Llama, DeepSeek,
                Qwen…) with a free tier. Get a key →{" "}
                <a
                  className="font-semibold text-coral hover:underline"
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  openrouter.ai/keys
                </a>
              </div>
              <div>
                ⚡ <b>Groq</b> — free &amp; extremely fast (Llama, DeepSeek). Key →{" "}
                <a
                  className="font-semibold text-coral hover:underline"
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.groq.com/keys
                </a>
              </div>
              <div>
                ✦ <b>Google Gemini</b> — free tier. Key →{" "}
                <a
                  className="font-semibold text-coral hover:underline"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  aistudio.google.com/apikey
                </a>
              </div>
              <div>
                🟩 <b>NVIDIA NIM</b> — works, but use <b>your own</b> fresh free
                key from build.nvidia.com (1000 calls/key). Once your key is added,
                these models run through the server proxy.
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                ✓ Browser-safe: Groq, Gemini, OpenRouter, Anthropic, Mistral
              </span>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                Needs deploy (Vercel proxy): NVIDIA, OpenAI, DeepSeek
              </span>
            </div>
            <div className="mt-2">
              Tap <b>Use</b> on a green ✓ card to chat with that real model. Keys
              are stored only in this browser.
            </div>
          </div>

          {/* slot cards */}
          <div className="space-y-3">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                active={slot.id === activeSlot}
                onSet={setSlot}
                onRemove={() => removeSlot(slot.id)}
                onActivate={() => setActiveSlot(slot.id)}
              />
            ))}
          </div>

          {/* add new key */}
          <AddKey onSave={setSlot} />
        </div>
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  active,
  onSet,
  onRemove,
  onActivate,
}: {
  slot: KeySlot;
  active: boolean;
  onSet: (s: KeySlot) => void;
  onRemove: () => void;
  onActivate: () => void;
}) {
  const p = getProvider(slot.provider);
  const [expanded, setExpanded] = useState(false);
  const [key, setKey] = useState(slot.apiKey);
  const [model, setModel] = useState(slot.model);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setKey(slot.apiKey);
    setModel(slot.model);
  }, [slot.apiKey, slot.model]);

  const status: "none" | "ok" | "fail" | "saved" =
    slot.ok === true ? "ok" : slot.ok === false ? "fail" : "saved";

  const handleTest = async () => {
    if (!key.trim()) return;
    setTesting(true);
    const proxy = await hasProxy();
    if (!proxy && !browserOk(slot.provider)) {
      onSet({
        ...slot,
        apiKey: key.trim(),
        model,
        ok: false,
        error: `Browser (CORS) blocks ${getProvider(slot.provider).name}. Deploy on Vercel (serverless proxy) OR use Groq, Gemini, or OpenRouter instead.`,
      });
      setTesting(false);
      return;
    }
    try {
      await testReal({ provider: slot.provider, apiKey: key.trim(), model });
      onSet({ ...slot, apiKey: key.trim(), model, ok: true, error: null });
      setExpanded(false);
    } catch (e) {
      onSet({ ...slot, apiKey: key.trim(), model, ok: false, error: explainError(slot.provider, e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-cream transition dark:bg-night",
        active
          ? "border-coral/60 shadow-[0_4px_18px_rgba(217,119,87,0.12)]"
          : status === "ok"
          ? "border-emerald-400/40"
          : status === "fail"
          ? "border-red-300/60"
          : "border-line dark:border-night-surface"
      )}
    >
      {/* header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[18px]"
          style={{ backgroundColor: p.color + "22", color: p.color }}
        >
          {p.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink dark:text-cream">
              {p.name}
            </span>
            {p.free && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Free
              </span>
            )}
            {active && (
              <span className="rounded bg-coral px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                Active
              </span>
            )}
          </div>
          <div className="truncate font-mono text-[12px] text-muted">{slot.model}</div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* error / success banners */}
      {status === "fail" && slot.error && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <CloseIcon size={14} className="mt-0.5 shrink-0" />
          <span className="break-words">{slot.error}</span>
        </div>
      )}
      {status === "ok" && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckIcon size={14} className="shrink-0" /> Connected & ready
        </div>
      )}

      {/* saved actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={onActivate}
          disabled={active}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition",
            active
              ? "cursor-default bg-coral/15 text-coral"
              : "bg-coral text-white hover:bg-coral-hover"
          )}
        >
          {active ? "● In use" : "Use this model"}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-cream-deep dark:border-night-surface dark:text-cream"
        >
          {expanded ? "Hide" : "Edit"}
        </button>
        <button
          onClick={onRemove}
          className="ml-auto rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          Remove
        </button>
      </div>

      {/* edit form */}
      {expanded && (
        <div className="border-t border-line px-4 py-3 dark:border-night-surface">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              API key
            </label>
            <a
              href={p.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-coral hover:underline"
            >
              Get a key ↗
            </a>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mb-2.5 w-full rounded-lg border border-line bg-cream px-3 py-2 font-mono text-[12.5px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Model
          </label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 font-mono text-[12.5px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />
          <button
            onClick={handleTest}
            disabled={!key.trim() || testing}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition",
              key.trim() && !testing
                ? "bg-ink text-cream hover:opacity-90 dark:bg-cream dark:text-ink"
                : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
            )}
          >
            {testing ? (
              <>
                <span className="h-2 w-2 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
                Testing connection…
              </>
            ) : (
              "Test & Save"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function AddKey({ onSave }: { onSave: (s: KeySlot) => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(PROVIDERS[2].models[0]);
  const [testing, setTesting] = useState(false);

  const p = getProvider(provider);
  useEffect(() => setModel(p.models[0]), [provider, p.models]);

  const handleSave = async () => {
    if (!key.trim()) return;
    setTesting(true);
    const id = `${provider}-${Date.now().toString(36)}`;
    const proxy = await hasProxy();
    if (!proxy && !browserOk(provider)) {
      onSave({
        id,
        provider,
        apiKey: key.trim(),
        model,
        ok: false,
        error: `Browser (CORS) blocks ${getProvider(provider).name}. Deploy on Vercel (serverless proxy) OR use Groq, Gemini, or OpenRouter instead.`,
      });
      setTesting(false);
      return;
    }
    try {
      await testReal({ provider, apiKey: key.trim(), model });
      onSave({ id, provider, apiKey: key.trim(), model, ok: true, error: null });
      setOpen(false);
      setKey("");
    } catch (e) {
      onSave({
        id,
        provider,
        apiKey: key.trim(),
        model,
        ok: false,
        error: explainError(provider, e),
      });
    } finally {
      setTesting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 text-[13px] font-semibold text-ink-soft transition hover:border-coral/50 hover:text-coral dark:border-night-surface dark:text-cream"
      >
        <PlusIcon size={16} /> Add another API key
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-cream p-4 dark:border-night-surface dark:bg-night">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink dark:text-cream">
          New API key
        </span>
        <button
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-2 hover:bg-cream-deep dark:hover:bg-night-surface"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        Provider
      </label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as Provider)}
        className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
      >
        {PROVIDERS.map((pr) => (
          <option key={pr.id} value={pr.id}>
            {pr.name}
          </option>
        ))}
      </select>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          API key
        </label>
        <a
          href={p.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-medium text-coral hover:underline"
        >
          Get a key ↗
        </a>
      </div>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={`Paste your ${p.name} API key`}
        className="mb-2.5 w-full rounded-lg border border-line bg-cream px-3 py-2 font-mono text-[12.5px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
      />
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        Model
      </label>
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="mb-3 w-full rounded-lg border border-line bg-cream px-3 py-2 font-mono text-[12.5px] text-ink focus:border-coral focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
      />
      <button
        onClick={handleSave}
        disabled={!key.trim() || testing}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition",
          key.trim() && !testing
            ? "bg-coral text-white hover:bg-coral-hover"
            : "cursor-not-allowed bg-cream-deep text-muted-2 dark:bg-night-surface"
        )}
      >
        {testing ? "Testing…" : "Test & Save"}
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: "none" | "ok" | "fail" | "saved" }) {
  if (status === "ok")
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-600 dark:bg-emerald-500/10">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
      </span>
    );
  if (status === "fail")
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase text-red-600 dark:bg-red-500/10">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Failed
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold uppercase text-sky-600 dark:bg-sky-500/10">
        <span className="h-2 w-2 animate-spin-slow rounded-full border-2 border-sky-500 border-t-transparent" /> Testing
      </span>
    );
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream-deep px-2 py-1 text-[10px] font-semibold uppercase text-muted dark:bg-night-surface">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Not set
    </span>
  );
}
