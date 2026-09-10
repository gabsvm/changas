import Link from "next/link";

import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { ServiceCard } from "./service-card";

export function NearbyServiceRail({
  rows,
  title,
  actionHref,
  layout = "rail",
}: {
  rows: ReputationDiscoveryServiceRow[];
  title: string;
  actionHref: string;
  layout?: "rail" | "stack";
}) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="nearby-services-title">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="nearby-services-title"
          className="text-lg font-bold tracking-[-0.025em]"
        >
          {title}
        </h2>
        <Link
          href={actionHref}
          className="brand-info-link consumer-pressable hover:bg-brand-orange/[0.07] inline-flex min-h-12 items-center rounded-lg px-2 text-sm font-bold"
        >
          Ver todo{" "}
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
      <ul
        className={
          layout === "stack"
            ? "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            : "consumer-scrollbar-none -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-0 sm:px-0"
        }
      >
        {rows.map((row) => (
          <li
            key={`${row.provider_slug}/${row.service_slug}`}
            className={
              layout === "stack" ? undefined : "w-[min(88vw,24rem)] shrink-0"
            }
          >
            <ServiceCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
