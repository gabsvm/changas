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
  | "sparkle"
  | "search"
  | "check"
  | "pin"
  | "star"
  | "compass"
  | "sliders"
  | "doc"
  | "id"
  | "image"
  | "alert"
  | "key"
  | "download"
  | "wifi"
  | "wallet"
  | "calendar";

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
  search: "M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.2-2.2L21 21",
  pin: "M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  compass:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z",
  sliders: "M5 7h14M5 12h14M5 17h14M9 4.5v5M15 9.5v5M9 14.5v5",
  doc: "M7 3.5h7l4 4v13H7v-17ZM14 3.5V8h4M10 12.5h5M10 16h5",
  id: "M3.5 7h17v10h-17V7ZM7 11.2h3M7 14h5M16.5 10.5a1.5 1.5 0 1 0 0 .01M16.5 14a1.5 1.5 0 1 0 0 .01",
  image: "M4 5.5h16v13H4v-13ZM4 16.5l4.5-4.5 3.5 3.5 2.5-2.5L20 18.5M9.5 10a1.5 1.5 0 1 0 0-.01",
  alert: "M12 3.5 2.5 20h19L12 3.5ZM12 9.5v5M12 17.5h.01",
  key: "M14 10a4 4 0 1 0-4 4c.4 0 .8-.1 1.1-.2L13 15.5h2v2h2v2h3v-3l-5.3-5.3c.1-.4.3-.8.3-1.2Z",
  download: "M12 3.5V15M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15",
  wifi: "M4 10a12 12 0 0 1 16 0M7 13.5a7.5 7.5 0 0 1 10 0M9.8 17a3.5 3.5 0 0 1 4.4 0M12 20h.01",
  wallet: "M4 7.5h16v11H4v-11ZM4 7.5V6a1.5 1.5 0 0 1 1.5-1.5h13L20 7.5M16.5 12.5h.01",
  calendar: "M5 6.5h14v13H5v-13ZM5 10h14M9 3.5v4M15 3.5v4",
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
