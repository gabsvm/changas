import Link from "next/link";

import { formatServicePrice } from "@changas/domain";

import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { Avatar } from "./avatar";
import { StatusChip } from "./status-chip";

const modalityLabels = {
  BOTH: "Presencial o remoto",
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
} as const;

// List-row presentation of a service (Uber-style): avatar, title, one line of
// context and the price. Example rows are fictional and not clickable.
export function ServiceRow({
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
  const content = (
    <div className="flex items-center gap-3.5 py-3.5">
      <Avatar
        name={row.provider_display_name}
        src={
          isTrustedPublicAvatarUrl(row.provider_avatar_url)
            ? row.provider_avatar_url
            : null
        }
        size="md"
        className="bg-ink/[0.06]! text-ink! h-12 w-12"
      />
      <div className="min-w-0 flex-1">
        {example ? (
          <StatusChip
            tone="warning"
            className="mb-1 min-h-0 px-2 py-0.5 text-[11px]"
          >
            Ejemplo
          </StatusChip>
        ) : null}
        <h3 className="text-ink line-clamp-2 text-[15px] leading-5 font-extrabold tracking-[-0.01em]">
          {row.service_title}
        </h3>
        <p className="text-ink/70 mt-0.5 flex items-center gap-x-2 truncate text-[13px]">
          <span className="text-ink inline-flex shrink-0 items-center gap-1 font-bold">
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
          {row.provider_zone ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10Z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              <span className="truncate">{row.provider_zone}</span>
            </span>
          ) : null}
          <span className="shrink-0">{modalityLabels[row.modality]}</span>
        </p>
      </div>
      <span className="text-ink shrink-0 text-[15px] font-extrabold">
        {price}
      </span>
    </div>
  );

  return (
    <article className="border-ink/10 border-b last:border-b-0">
      {example ? (
        <div
          role="group"
          aria-label={`Ejemplo ficticio: ${row.service_title}, ${price}`}
        >
          {content}
        </div>
      ) : (
        <Link
          href={`/p/${row.provider_slug}/${row.service_slug}`}
          className="consumer-pressable hover:bg-ink/[0.03] -mx-2 block rounded-xl px-2"
          aria-label={`${row.service_title}, ${row.provider_display_name}, ${price}`}
        >
          {content}
        </Link>
      )}
    </article>
  );
}
