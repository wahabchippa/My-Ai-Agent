"use client";

// Artifact "Open in new tab" — sandboxed preview page.
//
// 🔒 PICHLA BUG: artifact HTML blob URL se naye tab me khulta tha.
// blob: URLs SAME-ORIGIN hote hain — matlab AI-generated HTML aapke
// localStorage (API keys, chats) aur cookies tak access kar sakta tha.
// Prompt-injected artifact = keys chori.
//
// AB: content sessionStorage se aata hai (naya tab ise inherits karta
// hai) aur iframe me `sandbox="allow-scripts"` se render hota hai —
// allow-same-origin NAHI, is liye artifact scripts chala sakta hai magar
// app ke data tak NAHI pohanch sakta.

import { useState } from "react";

export default function ArtifactPreviewPage() {
  // sessionStorage lazy init — effect me setState nahi (lint rule).
  const [content, setContent] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("nexora-artifact");
    } catch {
      return null;
    }
  });
  const missing = content == null;

  return (
    <div className="flex h-screen w-screen flex-col bg-[#1d1d1b]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2 text-[13px] text-white/60">
        <span className="font-semibold text-white/90">Nexora — Artifact Preview</span>
        <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[11px]">
          sandboxed (no app access)
        </span>
        {!missing && (
          <a
            href={`data:text/html;charset=utf-8,${encodeURIComponent(content || "")}`}
            download="artifact.html"
            className="rounded bg-white/10 px-2 py-0.5 text-white/80 hover:bg-white/20"
          >
            ↓ Download
          </a>
        )}
      </div>
      {missing ? (
        <div className="flex flex-1 items-center justify-center text-white/50">
          No artifact found — pehle chat me artifact kholein, phir Open ↗ dabayein.
        </div>
      ) : (
        <iframe
          title="Artifact preview"
          srcDoc={content || ""}
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          className="h-full w-full flex-1 border-0 bg-white"
        />
      )}
    </div>
  );
}
