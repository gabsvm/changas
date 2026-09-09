import Link from "next/link";

import { manualLocations } from "@changas/domain";

export function LocationPicker({
  selected,
  compact = false,
}: {
  selected?: string | null;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="text-ink/58 flex min-h-11 items-center gap-2 text-sm font-semibold">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none">
          <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        <span className="sr-only">Zona</span>
        <select
          className="focus:border-moss/35 min-h-11 max-w-[12rem] rounded-lg border border-transparent bg-transparent px-1.5 text-sm font-semibold text-ink outline-none focus:bg-white"
          defaultValue={selected ?? ""}
          id="location"
          name="location"
        >
          <option value="">Sin ubicación</option>
          {manualLocations.map((location) => (
            <option key={location.slug} value={location.slug}>
              {location.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-ink/65 text-sm font-semibold" htmlFor="location">
        ¿Dónde lo necesitás?
      </label>
      <select
        className="consumer-control focus:border-moss/45 focus:ring-moss/10 w-full px-3 text-sm outline-none focus:ring-2"
        defaultValue={selected ?? ""}
        id="location"
        name="location"
      >
        <option value="">Sin ubicación</option>
        {manualLocations.map((location) => (
          <option key={location.slug} value={location.slug}>
            {location.label}
          </option>
        ))}
      </select>
      <p className="text-ink/50 text-xs">
        Es opcional. También podés{" "}
        <Link className="font-semibold text-terracotta" href="/buscar?mode=remoto">
          buscar remoto
        </Link>
        .
      </p>
    </div>
  );
}
