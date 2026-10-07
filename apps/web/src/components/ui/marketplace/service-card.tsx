import Image from "next/image";
import Link from "next/link";

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

function CoverFallback({
  categorySlug,
  categoryName,
  serviceTitle,
}: {
  categorySlug: string;
  categoryName: string;
  serviceTitle: string;
}) {
  return (
    <span
      className="from-brand-orange/25 via-brand-yellow/25 to-terracotta/20 grid aspect-video w-full place-items-center bg-linear-to-br"
      role="img"
      aria-label={`Imagen ilustrativa de ${serviceTitle}`}
    >
      <span className="flex flex-col items-center gap-1.5 px-4 text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="text-terracotta h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={categoryIconPath(categorySlug)} />
        </svg>
        <span className="text-terracotta text-xs font-bold tracking-wide uppercase">
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
      alt=""
      width={640}
      height={360}
      loading="lazy"
      unoptimized
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
      className={`service-card-shell consumer-card ${example ? "border-ink/30! border-dashed!" : "consumer-card-pressed"} bg-surface relative overflow-hidden transition-colors`}
    >
      {example ? (
        <div
          className="block"
          role="group"
          aria-label={`Ejemplo ficticio: ${row.service_title}, ${price}`}
        >
          {cover}
          <div className="p-4">
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

          <div className="p-4">
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
                  <Link
                    href={providerHref}
                    className="focus-visible:ring-2 focus-visible:ring-moss/45 truncate rounded underline-offset-4 hover:underline"
                  >
                    {row.provider_display_name}
                  </Link>
                  {row.provider_zone ? (
                    <span className="shrink-0 font-normal">
                      · {row.provider_zone}
                    </span>
                  ) : null}
                </p>
                <h3 className="text-ink mt-0.5 line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em]">
                  <Link
                    href={serviceHref}
                    className="focus-visible:ring-2 focus-visible:ring-moss/45 rounded"
                    aria-label={`${row.service_title}, ${row.provider_display_name}, ${price}`}
                  >
                    {row.service_title}
                  </Link>
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
                      Nuevo en Changas · sin reseñas aún
                    </span>
                  )}
                  <span className="text-terracotta ml-auto shrink-0 text-[15px] font-extrabold">
                    {price}
                  </span>
                </p>
                {hasRating ? null : (
                  <Link
                    href={providerHref}
                    className="focus-visible:ring-2 focus-visible:ring-moss/45 text-terracotta mt-1.5 inline-flex min-h-11 items-center text-[13px] font-bold"
                  >
                    Ver perfil del proveedor <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
