import type { SVGProps } from "react";

/**
 * ClaudeLogo — the sunburst "asterisk" mark.
 * Stylized approximation of Anthropic's Claude brand symbol.
 */
export function ClaudeLogo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g fill="currentColor">
        <path d="M16 4c.9 2.6 1.4 5.4 1.4 8 0 4.8-1.2 6.6-1.2 6.6S15 16.8 15 12c0-2.6.4-5.4 1-8z" />
        <path d="M28 16c-2.6.9-5.4 1.4-8 1.4-4.8 0-6.6-1.2-6.6-1.2S15.2 15 20 15c2.6 0 5.4.4 8 1z" />
        <path d="M16 28c-.9-2.6-1.4-5.4-1.4-8 0-4.8 1.2-6.6 1.2-6.6s1.2 1.8 1.2 6.6c0 2.6-.4 5.4-1 8z" />
        <path d="M4 16c2.6-.9 5.4-1.4 8-1.4 4.8 0 6.6 1.2 6.6 1.2S16.8 17 12 17c-2.6 0-5.4-.4-8-1z" />
        <path d="M24.5 7.5c-1 2.6-2.4 5-4.2 6.9-3.4 3.4-5.5 3.9-5.5 3.9s.5-2.1 3.9-5.5c1.9-1.8 4.3-3.3 6.9-4.2-.4-.2-.7-.7-1.1-1.1z" />
        <path d="M24.5 24.5c-2.6-1-5-2.4-6.9-4.2-3.4-3.4-3.9-5.5-3.9-5.5s2.1.5 5.5 3.9c1.8 1.9 3.3 4.3 4.2 6.9.4-.4.7-.8 1.1-1.1z" />
        <path d="M7.5 24.5c1-2.6 2.4-5 4.2-6.9 3.4-3.4 5.5-3.9 5.5-3.9s-.5 2.1-3.9 5.5c-1.9 1.8-4.3 3.3-6.9 4.2.4.4.7.7 1.1 1.1z" />
        <path d="M7.5 7.5c2.6 1 5 2.4 6.9 4.2 3.4 3.4 3.9 5.5 3.9 5.5s-2.1-.5-5.5-3.9C11 11.5 9.5 9.1 8.6 6.5c-.4.4-.7.7-1.1 1.1z" />
      </g>
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const PencilIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );

export const SearchIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );

export const ChevronDown = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

export const ChevronRight = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );

export const ArrowUp = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );

export const Paperclip = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

export const SpeakerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

export const PlusIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );

export const SendIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );

export const StopIcon = (p: IconProps) =>
  (
    <svg {...base({ size: p.size ?? 18, ...p })}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );

export const CopyIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

export const CheckIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );

export const ThumbUp = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );

export const ThumbDown = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );

export const RefreshIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );

export const SparkleIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );

export const TerminalIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  );

export const MessageIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );

export const MenuIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

export const CloseIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );

export const TrashIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );

export const SunIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );

export const MoonIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );

export const FolderIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );

export const BoltIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );

export const GlobeIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );

export const BookIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );

export const MoreIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );

export const QuoteIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M9 7H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2" />
      <path d="M20 7h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2" />
    </svg>
  );

export const BrainIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M12 5a3 3 0 0 0-5.99.2A3 3 0 0 0 4 11a3 3 0 0 0 1.5 5.6A2.5 2.5 0 0 0 9.5 21c1.4 0 2.5-1 2.5-2.5V5Z" />
      <path d="M12 5a3 3 0 0 1 5.99.2A3 3 0 0 1 20 11a3 3 0 0 1-1.5 5.6A2.5 2.5 0 0 1 14.5 21C13.1 21 12 20 12 18.5V5Z" />
    </svg>
  );

export const FileIcon = (p: IconProps) =>
  (
    <svg {...base(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
