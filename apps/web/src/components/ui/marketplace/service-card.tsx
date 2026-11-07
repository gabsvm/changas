import Image from "next/image";
import Link from "next/link";

import { ActionArrowIcon } from "./action-arrow-icon";

import {
  distanceBucketLabels,
  formatServicePrice,
  type DistanceBucket,
} from "@changas/domain";

import {
  isTrustedPublicAvatarUrl,
  isValidPortfolioMediaPath,
  portfolioPublicUrl,
} from "@/lib/discovery/public-media";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { Avatar } from "./avatar";
import { StatusChip } from "./status-chip";

const modalityLabels = {
  BOTH: "Presencial o remoto",
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
} as const;

function categoryIconPath(categorySlug: string): string {
  switch (categorySlug) {
    case "hogar":
      return "M4 11.5 12 4l8 7.5M6 10v9h12v-9";
    case "tecnologia":
      return "M5 7h14v10H5zM9 21h6M12 17v4";
    case "educacion":
      return "M12 4 3 9l9 5 9-5-9-5ZM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5";
    case "mascotas":
      return "M12 13.5c-2.8 0-5.5 2-5.5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.9-.5 3.1-.5s2.1.5 3.1.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.7-4.2-5.5-4.2ZM8 9.5c-1 0-1.8-1-1.8-2.3S7 5 8 5s1.8 1 1.8 2.2S9 9.5 8 9.5Zm8 0c-1 0-1.8-1-1.8-2.3S15 5 16 5s1.8 1 1.8 2.2S17 9.5 16 9.5ZM12 11c-1 0-1.8-1-1.8-2.2S11 6.5 12 6.5s1.8 1 1.8 2.3S13 11 12 11Z";
    default:
      return "M12 3v18M5 8.5c4-2.5 10-2.5 14 0M5 15.5c4 2.5 10 2.5 14 0";
  }
}

// YALO D1: covers sobrios sobre navy (texto blanco encima, AA sobrado).
// Sin naranjas/rosas legacy; el verde/dorado profundo son semánticos.
const COVER_VISUALS: ReadonlyArray<{
  match: RegExp;
  from: string;
  to: string;
}> = [
  { match: /hogar/i, from: "#243145", to: "#0D121B" },
  { match: /tecnologia/i, from: "#14568A", to: "#0D121B" },
  { match: /educacion/i, from: "#166B45", to: "#0B1F16" },
  { match: /mascotas/i, from: "#8A2B35", to: "#2B0E12" },
  { match: /profesional|admin|contab|legal/i, from: "#3B4A6B", to: "#0D121B" },
  { match: /belleza|bienestar|salud|pelu/i, from: "#7A5B16", to: "#241A06" },
];

const FALLBACK_COVER_VISUAL = { from: "#243145", to: "#0D121B" };

function coverVisual(categorySlug: string): { from: string; to: string } {
  return (
    COVER_VISUALS.find((entry) => entry.match.test(categorySlug)) ??
    FALLBACK_COVER_VISUAL
  );
}

function CoverFallback({
  categorySlug,
  categoryName,
  serviceTitle,
}: {
  categorySlug: string;
  categoryName: string;
  serviceTitle: string;
}) {
  const visual = coverVisual(categorySlug);
  return (
    <span
      className="service-card-cover-fallback relative flex w-full items-center overflow-hidden px-4 py-2.5"
      style={{
        background: visual.from,
      }}
      role="img"
      aria-label={`Imagen ilustrativa de ${serviceTitle}`}
    >
      
      <span
        className="hidden"
        aria-hidden="true"
      />
      <span
        className="hidden"
        aria-hidden="true"
      />
      <span className="service-card-cover-fallback-label relative flex items-center gap-2 text-left">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={categoryIconPath(categorySlug)} />
        </svg>
        <span className="text-xs font-semibold text-white/90">
          {categoryName}
        </span>
      </span>
    </span>
  );
}

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
  const serviceHref = `/p/${row.provider_slug}/${row.service_slug}`;
  const providerHref = `/p/${row.provider_slug}`;
  const coverSrc =
    row.cover_image_url && isValidPortfolioMediaPath(row.cover_image_url)
      ? portfolioPublicUrl(row.cover_image_url)
      : null;
  const cover = coverSrc ? (
    <Image
      className="aspect-video w-full object-cover"
      src={coverSrc}
      alt={`${row.service_title} de ${row.provider_display_name}`}
      width={640}
      height={360}
      sizes="(max-width: 640px) 100vw, 640px"
      loading="lazy"
    />
  ) : (
    <CoverFallback
      categorySlug={row.category_slug}
      categoryName={row.category_name}
      serviceTitle={row.service_title}
    />
  );

  return (
    <article
      className={`service-card-shell consumer-card group bg-surface hover:border-brand-primary/25 relative overflow-hidden transition-colors duration-200 dark:hover:border-white/20 ${example ? "border-ink/30! border-dashed!" : "consumer-card-pressed"}`}
    >
      {example ? (
        <div
          className="block"
          role="group"
          aria-label={`Ejemplo ficticio: ${row.service_title}, ${price}`}
        >
          {cover}
          <div className="service-card-content p-4">
            <div className="service-card-provider-row flex items-start gap-3">
              <Avatar
                name={row.provider_display_name}
                src={
                  isTrustedPublicAvatarUrl(row.provider_avatar_url)
                    ? row.provider_avatar_url
                    : null
                }
                size="md"
              />
              <div className="service-card-provider min-w-0 flex-1">
                <p className="text-ink/70 flex items-center gap-1.5 truncate text-[13px] font-semibold">
                  <span className="truncate">{row.provider_display_name}</span>
                  {row.provider_zone ? (
                    <span className="shrink-0 font-normal">
                      · {row.provider_zone}
                    </span>
                  ) : null}
                </p>
                <h3 className="service-card-title text-ink mt-1.5 line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em]">
                  {row.service_title}
                </h3>
                <div className="service-card-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <p className="service-card-rating flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-ink inline-flex items-center gap-1 font-bold">
                      {hasRating ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="stroke-warning h-3.5 w-3.5 fill-[#F0B429]"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                      {hasRating
                        ? row.rating_average!.toFixed(1)
                        : "Nuevo en YALO"}
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
                  </p>
                  <span className="service-card-price text-brand-primary ml-auto shrink-0 text-[15px] font-semibold dark:text-white">
                    {price}
                  </span>
                </div>
              </div>
            </div>

            <div className="service-card-tags mt-3 flex flex-wrap items-center gap-1.5">
              <StatusChip tone="warning">Ejemplo</StatusChip>
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
        </div>
      ) : (
        <>
          <Link
            href={serviceHref}
            className="consumer-pressable block"
            tabIndex={-1}
            aria-hidden="true"
          >
            {cover}
          </Link>

          <div className="service-card-content p-4">
            <div className="service-card-provider-row flex items-start gap-3">
              <Avatar
                name={row.provider_display_name}
                src={
                  isTrustedPublicAvatarUrl(row.provider_avatar_url)
                    ? row.provider_avatar_url
                    : null
                }
                size="md"
              />
              <div className="service-card-provider min-w-0 flex-1">
                <p className="text-ink/70 flex items-center gap-1.5 truncate text-[13px] font-semibold">
                  <Link
                    href={providerHref}
                    className="focus-visible:ring-focus/45 inline-flex min-h-11 max-w-full items-center truncate rounded underline-offset-4 hover:underline focus-visible:ring-2"
                  >
                    {row.provider_display_name}
                  </Link>
                  {row.provider_zone ? (
                    <span className="shrink-0 font-normal">
                      · {row.provider_zone}
                    </span>
                  ) : null}
                  {/* Toda fila de discovery trae prestadores con status ACTIVE
                      (revisión de identidad aprobada por el servidor en
                      search_discovery_services_v4): el badge es dato real. */}
                  <span
                    className="shrink-0 font-bold text-ink"
                    title="Identidad verificada por YALO"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"-2px"}}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> Verificado
                  </span>
                </p>
                <h3 className="service-card-title text-ink mt-1.5 line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em]">
                  <Link
                    href={serviceHref}
                    className="focus-visible:ring-focus/45 inline-flex min-h-11 items-center rounded focus-visible:ring-2"
                    aria-label={`${row.service_title}, ${row.provider_display_name}, ${price}`}
                  >
                    {row.service_title}
                  </Link>
                </h3>
                <div className="service-card-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <p className="service-card-rating flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-ink inline-flex items-center gap-1 font-bold">
                      {hasRating ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="stroke-warning h-3.5 w-3.5 fill-[#F0B429]"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                      {hasRating
                        ? row.rating_average!.toFixed(1)
                        : "Nuevo en YALO"}
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
                  </p>
                  <span className="service-card-price text-brand-primary ml-auto shrink-0 text-[15px] font-semibold dark:text-white">
                    {price}
                  </span>
                </div>
                {hasRating ? null : (
                  <Link
                    href={providerHref}
                    className="service-card-provider-link focus-visible:ring-focus/45 text-brand-primary mt-1.5 inline-flex min-h-11 items-center text-[13px] font-bold focus-visible:ring-2 dark:text-white"
                  >
                    Ver perfil del proveedor{" "}
                    <ActionArrowIcon className="ml-1 h-4 w-4 shrink-0" />
                  </Link>
                )}
              </div>
            </div>

            <div className="service-card-tags mt-3 flex flex-wrap items-center gap-1.5">
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
        </>
      )}
    </article>
  );
}
