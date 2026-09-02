import Link from "next/link";

import {
  distanceBucketLabels,
  formatServicePrice,
  type DistanceBucket,
} from "@changas/domain";

import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

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

export function DiscoveryCard({ row }: { row: ReputationDiscoveryServiceRow }) {
  const completionPercent =
    row.completion_rate === null ? null : Math.round(row.completion_rate * 100);

  return (
    <article className="border-ink/10 rounded-2xl border bg-white/75 p-5 shadow-[0_12px_32px_rgba(22,56,50,0.06)]">
      <div className="flex items-start gap-3">
        {isTrustedPublicAvatarUrl(row.provider_avatar_url) ? (
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
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {row.review_count > 0 && row.rating_average !== null ? (
              <span className="text-ink font-semibold">
                ★ {row.rating_average.toFixed(1)} · {row.review_count}{" "}
                {row.review_count === 1 ? "reseña" : "reseñas"}
              </span>
            ) : (
              <span className="text-terracotta font-semibold">
                Nuevo proveedor
              </span>
            )}
            {row.provider_zone ? (
              <span className="text-ink/50">{row.provider_zone}</span>
            ) : null}
          </div>
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

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="bg-canvas rounded-full px-2.5 py-1 font-semibold">
          {row.completed_jobs} completados
        </span>
        {completionPercent !== null && row.completed_jobs > 0 ? (
          <span className="bg-canvas rounded-full px-2.5 py-1 font-semibold">
            {completionPercent}% finalización
          </span>
        ) : null}
        {row.repeat_client_count > 0 ? (
          <span className="bg-canvas rounded-full px-2.5 py-1 font-semibold">
            {row.repeat_client_count} clientes recurrentes
          </span>
        ) : null}
      </div>

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
        {row.distance_bucket !== null ? (
          <span className="text-ink/60">
            {distanceBucketLabels[row.distance_bucket as DistanceBucket]}
          </span>
        ) : null}
      </div>
    </article>
  );
}
