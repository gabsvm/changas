import Link from "next/link";

import {
  distanceBucketLabels,
  formatServicePrice,
  type DistanceBucket,
} from "@changas/domain";

import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { Avatar } from "./avatar";
import { StatusChip } from "./status-chip";

const modalityLabels = {
  BOTH: "Presencial o remoto",
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
} as const;

export function ServiceCard({
  row,
  example = false,
}: {
  row: ReputationDiscoveryServiceRow;
  example?: boolean;
}) {
  const price = formatServicePrice(
    row.price_model,
    row.price_amount,
    row.currency_code,
    row.price_unit,
  );
  const hasRating = row.review_count > 0 && row.rating_average !== null;

  return (
    <article
      className={`service-card-shell consumer-card ${example ? "border-ink/30! border-dashed!" : "consumer-card-pressed"} bg-surface relative overflow-hidden transition-colors`}
    >
      {example ? (
        <div
          className="block p-4"
          role="group"
          aria-label={`Ejemplo ficticio: ${row.service_title}, ${price}`}
        >
          <div className="flex items-start gap-3">
            <Avatar
              name={row.provider_display_name}
              src={
                isTrustedPublicAvatarUrl(row.provider_avatar_url)
                  ? row.provider_avatar_url
                  : null
              }
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-ink/70 flex items-center gap-1.5 truncate text-[13px] font-semibold">
                <span className="truncate">{row.provider_display_name}</span>
                {row.provider_zone ? (
                  <span className="shrink-0 font-normal">
                    · {row.provider_zone}
                  </span>
                ) : null}
              </p>
              <h3 className="text-ink mt-0.5 line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em]">
                {row.service_title}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span className="text-ink inline-flex items-center gap-1 font-bold">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="fill-brand-yellow stroke-warning h-3.5 w-3.5"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {hasRating ? row.rating_average!.toFixed(1) : "Nuevo"}
                </span>
                {hasRating ? (
                  <span className="text-ink/70 font-medium">
                    ({row.review_count})
                    {row.completed_jobs > 0
                      ? ` · ${row.completed_jobs} hechos`
                      : ""}
                  </span>
                ) : (
                  <span className="text-ink/70 font-medium">
                    Sin reseñas aún
                  </span>
                )}
                <span className="text-terracotta ml-auto shrink-0 text-[15px] font-extrabold">
                  {price}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {example ? <StatusChip tone="warning">Ejemplo</StatusChip> : null}
            <StatusChip tone="neutral">
              {modalityLabels[row.modality]}
            </StatusChip>
            {row.distance_bucket !== null ? (
              <StatusChip tone="info">
                {distanceBucketLabels[row.distance_bucket as DistanceBucket]}
              </StatusChip>
            ) : null}
            {row.accepts_offers ? (
              <StatusChip tone="brand">Acepta ofertas</StatusChip>
            ) : null}
          </div>
        </div>
      ) : (
        <Link
          href={`/p/${row.provider_slug}/${row.service_slug}`}
          className="consumer-pressable block p-4"
          aria-label={`${row.service_title}, ${row.provider_display_name}, ${price}`}
        >
          <div className="flex items-start gap-3">
            <Avatar
              name={row.provider_display_name}
              src={
                isTrustedPublicAvatarUrl(row.provider_avatar_url)
                  ? row.provider_avatar_url
                  : null
              }
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-ink/70 flex items-center gap-1.5 truncate text-[13px] font-semibold">
                <span className="truncate">{row.provider_display_name}</span>
                {row.provider_zone ? (
                  <span className="shrink-0 font-normal">
                    · {row.provider_zone}
                  </span>
                ) : null}
              </p>
              <h3 className="text-ink mt-0.5 line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em]">
                {row.service_title}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span className="text-ink inline-flex items-center gap-1 font-bold">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="fill-brand-yellow stroke-warning h-3.5 w-3.5"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {hasRating ? row.rating_average!.toFixed(1) : "Nuevo"}
                </span>
                {hasRating ? (
                  <span className="text-ink/70 font-medium">
                    ({row.review_count})
                    {row.completed_jobs > 0
                      ? ` · ${row.completed_jobs} hechos`
                      : ""}
                  </span>
                ) : (
                  <span className="text-ink/70 font-medium">
                    Sin reseñas aún
                  </span>
                )}
                <span className="text-terracotta ml-auto shrink-0 text-[15px] font-extrabold">
                  {price}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {example ? <StatusChip tone="warning">Ejemplo</StatusChip> : null}
            <StatusChip tone="neutral">
              {modalityLabels[row.modality]}
            </StatusChip>
            {row.distance_bucket !== null ? (
              <StatusChip tone="info">
                {distanceBucketLabels[row.distance_bucket as DistanceBucket]}
              </StatusChip>
            ) : null}
            {row.accepts_offers ? (
              <StatusChip tone="brand">Acepta ofertas</StatusChip>
            ) : null}
          </div>
        </Link>
      )}
    </article>
  );
}
