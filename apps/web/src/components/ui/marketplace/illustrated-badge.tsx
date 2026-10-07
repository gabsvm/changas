export type IllustratedTone =
  | "orange"
  | "blue"
  | "green"
  | "rose"
  | "violet"
  | "gold"
  | "neutral";

export type IllustratedIconName =
  | "user"
  | "shield"
  | "heart"
  | "bell"
  | "briefcase"
  | "clock"
  | "gear"
  | "chat"
  | "tag"
  | "sparkle";

const TONES: Record<IllustratedTone, { from: string; to: string }> = {
  orange: { from: "#FF9A3D", to: "#EE5A24" },
  blue: { from: "#4F8DFF", to: "#2F4BFE" },
  green: { from: "#2FBF71", to: "#0E7C46" },
  rose: { from: "#FB6F92", to: "#E14D7A" },
  violet: { from: "#8B7CFF", to: "#5B4BD6" },
  gold: { from: "#F5B942", to: "#DE7E1F" },
  neutral: { from: "#A8A29E", to: "#78716C" },
};

const PATHS: Record<IllustratedIconName, string> = {
  user: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5",
  shield:
    "M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3Zm-2.4 9.4 1.7 1.7 3.2-3.6",
  heart:
    "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16ZM10 21a2.2 2.2 0 0 0 4 0",
  briefcase:
    "M4 8.5h16V19H4V8.5ZM9 8.5V6.8A1.8 1.8 0 0 1 10.8 5h2.4a1.8 1.8 0 0 1 1.8 1.8v1.7M4 13.5h16",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5.2l3.4 2",
  gear: "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z",
  chat: "M4 6.5h16v10H9l-5 4v-14Z",
  tag: "M4 5h7l9 9-7 5-9-9V5Zm4.5 4.5h.01",
  sparkle:
    "M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18",
};

const SIZES = {
  sm: { box: "h-9 w-9 rounded-xl", icon: "h-5 w-5" },
  md: { box: "h-11 w-11 rounded-2xl", icon: "h-6 w-6" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
} as const;

export function IllustratedBadge({
  tone,
  icon,
  size = "md",
  label,
}: {
  tone: IllustratedTone;
  icon: IllustratedIconName;
  size?: keyof typeof SIZES;
  label?: string;
}) {
  const gradient = TONES[tone];
  const dims = SIZES[size];
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden ${dims.box} shadow-[0_6px_16px_-6px_rgb(23_20_15/40%)] dark:shadow-[0_6px_16px_-6px_rgb(0_0_0/70%)]`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
      role="img"
      aria-label={label}
    >
      <span
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
          backgroundSize: "10px 10px",
        }}
        aria-hidden="true"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`relative ${dims.icon} text-white drop-shadow-[0_1px_4px_rgb(0_0_0/30%)]`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATHS[icon]} />
      </svg>
    </span>
  );
}
