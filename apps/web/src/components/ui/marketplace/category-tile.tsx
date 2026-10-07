import Link from "next/link";

import { CategoryIcon } from "./category-icon";

type CategoryVisual = {
  from: string;
  to: string;
};

const VISUALS: ReadonlyArray<{ match: RegExp; visual: CategoryVisual }> = [
  { match: /hogar|limpieza|casa/i, visual: { from: "#FF9A3D", to: "#EE5A24" } },
  {
    match: /tecno|comput|inform|diseño|program/i,
    visual: { from: "#4F8DFF", to: "#2F4BFE" },
  },
  {
    match: /educa|clase|curso|idioma/i,
    visual: { from: "#2FBF71", to: "#0E7C46" },
  },
  {
    match: /mascota|perro|gato|paseo/i,
    visual: { from: "#FB6F92", to: "#E14D7A" },
  },
  {
    match: /profesional|admin|contab|legal/i,
    visual: { from: "#8B7CFF", to: "#5B4BD6" },
  },
  {
    match: /belleza|bienestar|salud|pelu/i,
    visual: { from: "#F5B942", to: "#DE7E1F" },
  },
];

const FALLBACK_VISUAL: CategoryVisual = { from: "#A8A29E", to: "#78716C" };

export function CategoryTile({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description?: string | null;
  icon: string;
}) {
  const visual =
    VISUALS.find((entry) => entry.match.test(icon))?.visual ??
    FALLBACK_VISUAL;
  return (
    <Link
      href={href}
      className="consumer-pressable group flex min-w-0 flex-col items-stretch gap-1.5 text-center"
      aria-label={description ? `${label}: ${description}` : label}
    >
      <span
        className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl shadow-[0_8px_20px_-8px_rgb(23_20_15/35%)] transition-transform duration-200 group-active:scale-[0.96] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/70%)]"
        style={{
          backgroundImage: `linear-gradient(135deg, ${visual.from} 0%, ${visual.to} 100%)`,
        }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
            backgroundSize: "12px 12px",
          }}
        />
        <span className="absolute -right-4 -bottom-5 h-16 w-16 rounded-full bg-white/20" />
        <span className="absolute -top-3 -left-3 h-10 w-10 rounded-full bg-white/15" />
        <CategoryIcon
          slug={icon}
          className="relative h-9 w-9 text-white drop-shadow-[0_2px_6px_rgb(0_0_0/25%)]"
        />
      </span>
      <span className="text-ink line-clamp-2 min-h-8 px-0.5 text-xs leading-4 font-bold">
        {label}
      </span>
    </Link>
  );
}
