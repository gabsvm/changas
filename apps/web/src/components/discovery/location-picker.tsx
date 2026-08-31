import Link from "next/link";

import { manualLocations } from "@changas/domain";

export function LocationPicker({
  selected,
  compact = false,
}: {
  selected?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "flex flex-col gap-2 sm:flex-row sm:items-end" : "space-y-2"
      }
    >
      <label className="text-ink/65 text-sm font-semibold" htmlFor="location">
        {compact ? "Zona" : "¿Dónde lo necesitás?"}
      </label>
      <select
        className="border-ink/15 focus:border-terracotta focus:ring-terracotta/30 min-h-11 rounded-xl border bg-white/80 px-3 text-sm outline-none focus:ring-2"
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
      {!compact ? (
        <p className="text-ink/50 text-xs">
          Es opcional. También podés{" "}
          <Link
            className="underline underline-offset-2"
            href="/buscar?mode=remoto"
          >
            buscar remoto
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
