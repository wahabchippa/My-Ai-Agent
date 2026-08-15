import type { ReactNode } from "react";

export type ModelId = "fable" | "opus" | "sonnet" | "haiku";

export interface ClaudeModel {
  id: ModelId;
  name: string;
  family: string;
  tagline: string;
  description: string;
  /** words emitted per tick while streaming — drives perceived speed */
  speed: number;
  /** context window in tokens */
  context: string;
  /** max output in tokens */
  output: string;
  /** relative strength rating, 1-5 */
  intelligence: number;
  /** accent swatch for the pill */
  accent: string;
  badge?: string;
  /** does the model show extended "thinking" before answering */
  thinks?: boolean;
  /** official API alias, for realism */
  alias: string;
}

/**
 * Nexora tiers, ranked Flash < Core < Pro < Ultra. Each tier maps to a real
 * model on the backend (/api/chat → OpenRouter).
 */
export const MODELS: ClaudeModel[] = [
  {
    id: "fable",
    name: "Nexora Ultra",
    family: "Ultra",
    tagline: "Flagship · most capable",
    description:
      "The flagship model for the hardest, longest-running work — deep research, complex coding, advanced reasoning, vision and long-context agents.",
    speed: 3,
    context: "1M",
    output: "128K",
    intelligence: 5,
    accent: "#7C5CE0",
    badge: "Flagship",
    thinks: true,
    alias: "apna-ultra",
  },
  {
    id: "opus",
    name: "Nexora Pro",
    family: "Pro",
    tagline: "Maximum intelligence",
    description:
      "Frontier intelligence for complex agentic coding, enterprise workloads, math and long-horizon reasoning with adaptive thinking.",
    speed: 4,
    context: "1M",
    output: "128K",
    intelligence: 5,
    accent: "#D97757",
    badge: "Frontier",
    thinks: true,
    alias: "apna-pro",
  },
  {
    id: "sonnet",
    name: "Nexora Core",
    family: "Core",
    tagline: "Best balance of speed & intelligence",
    description:
      "The everyday workhorse — excellent at coding, reasoning and writing with near-instant responses. A great default for most tasks.",
    speed: 6,
    context: "1M",
    output: "128K",
    intelligence: 4,
    accent: "#1AA39A",
    thinks: true,
    alias: "apna-core",
  },
  {
    id: "haiku",
    name: "Nexora Flash",
    family: "Flash",
    tagline: "Fastest & lowest cost",
    description:
      "The quickest, lightest model for daily tasks, quick answers and high-throughput workloads where speed matters most.",
    speed: 9,
    context: "200K",
    output: "64K",
    intelligence: 3,
    accent: "#5BA88A",
    alias: "apna-flash",
  },
];

export function getModel(id: ModelId): ClaudeModel {
  return MODELS.find((m) => m.id === id) ?? MODELS[2];
}

/** Render the five-dot intelligence meter */
export function IntelligenceMeter({
  value,
  color,
}: {
  value: number;
  color: string;
}): ReactNode {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: i <= value ? color : "rgba(135,134,126,0.28)",
          }}
        />
      ))}
    </span>
  );
}
