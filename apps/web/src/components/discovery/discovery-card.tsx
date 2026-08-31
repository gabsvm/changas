import Link from "next/link";

import { formatServicePrice } from "@changas/domain";

import type { DiscoveryServiceRow } from "@/lib/supabase/database.types";

const modalityLabels = {
  BOTH: "Presencial o remoto",
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
} as const;

function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function DiscoveryCard({ row }: { row: DiscoveryServiceRow }) {
  return (
    <article className="border-ink/10 rounded-2xl border bg-white/75 p-5 shadow-[0_12px_32px_rgba(22,56,50,0.06)]">
      <div className="flex items-start gap-3">
        {row.provider_avatar_url ? (
          // Public profile avatars are optional and come from the safe RPC projection.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-11 w-11 rounded-full object-cover"
            src={row.provider_avatar_url}
            alt={"Avatar de " + row.provider_display_name}
          />
        ) : (
          <span
            className="bg-terracotta/15 text-terracotta grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold"
            aria-hidden="true"
          >
            {initials(row.provider_display_name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            className="text-ink/65 text-sm font-semibold underline-offset-4 hover:underline"
            href={"/p/" + row.provider_slug}
          >
            {row.provider_display_name}
          </Link>
          {row.provider_zone ? (
            <p className="text-ink/50 mt-1 text-xs">
              Zona aproximada: {row.provider_zone}
            </p>
          ) : null}
        </div>
        <span className="bg-moss/10 text-moss rounded-full px-2.5 py-1 text-xs font-semibold">
          {modalityLabels[row.modality]}
        </span>
      </div>

      <Link
        className="group mt-5 block"
        href={"/p/" + row.provider_slug + "/" + row.service_slug}
      >
        <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
          {row.category_name} · {row.skill_name}
        </p>
        <h3 className="font-display mt-2 text-2xl font-semibold group-hover:underline">
          {row.service_title}
        </h3>
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">
          {formatServicePrice(
            row.price_model,
            row.price_amount,
            row.currency_code,
            row.price_unit,
          )}
        </span>
        {row.accepts_offers ? (
          <span className="text-ink/60">Acepta ofertas</span>
        ) : null}
        {row.distance_meters !== null ? (
          <span className="text-ink/60">
            {row.distance_meters < 1000
              ? row.distance_meters + " m aprox."
              : (row.distance_meters / 1000).toFixed(1) + " km aprox."}
          </span>
        ) : null}
      </div>
    </article>
  );
}
