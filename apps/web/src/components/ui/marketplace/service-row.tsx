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
  const context = [
    hasRating ? `★ ${row.rating_average!.toFixed(1)}` : "Nuevo",
    row.provider_zone,
    modalityLabels[row.modality],
  ]
    .filter(Boolean)
    .join(" · ");

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
        <p className="text-ink/70 mt-0.5 truncate text-[13px]">{context}</p>
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
