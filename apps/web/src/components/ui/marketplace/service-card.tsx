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

export function ServiceCard({ row }: { row: ReputationDiscoveryServiceRow }) {
  const price = formatServicePrice(
    row.price_model,
    row.price_amount,
    row.currency_code,
    row.price_unit,
  );

  return (
    <article className="consumer-card bg-surface overflow-hidden transition-transform duration-150 hover:-translate-y-0.5">
      <Link
        href={`/p/${row.provider_slug}/${row.service_slug}`}
        className="consumer-pressable group block p-4 hover:bg-white"
      >
        <div className="flex items-start gap-3">
          <Avatar
            name={row.provider_display_name}
            src={isTrustedPublicAvatarUrl(row.provider_avatar_url) ? row.provider_avatar_url : null}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink/55 truncate text-xs font-semibold">
                  {row.provider_display_name}
                  {row.provider_zone ? ` · ${row.provider_zone}` : ""}
                </p>
                <h3 className="mt-0.5 line-clamp-2 text-[1.02rem] leading-6 font-bold tracking-[-0.015em] text-ink">
                  {row.service_title}
                </h3>
              </div>
              <span className="text-terracotta shrink-0 text-sm font-bold">{price}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip tone="neutral">{modalityLabels[row.modality]}</StatusChip>
              {row.distance_bucket !== null ? (
                <StatusChip tone="info">
                  {distanceBucketLabels[row.distance_bucket as DistanceBucket]}
                </StatusChip>
              ) : null}
              {row.accepts_offers ? <StatusChip tone="brand">Acepta ofertas</StatusChip> : null}
            </div>

            <div className="text-ink/48 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {row.review_count > 0 && row.rating_average !== null ? (
                <span className="font-semibold text-ink/70">
                  ★ {row.rating_average.toFixed(1)} · {row.review_count} {row.review_count === 1 ? "reseña" : "reseñas"}
                </span>
              ) : (
                <span>Nuevo proveedor</span>
              )}
              {row.completed_jobs > 0 ? <span>{row.completed_jobs} completados</span> : null}
              <span>{row.category_name}</span>
            </div>
            <span className="text-terracotta mt-3 inline-flex min-h-11 items-center text-sm font-bold">
              Ver servicio <span className="ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
