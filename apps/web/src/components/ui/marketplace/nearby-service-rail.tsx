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
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2
          id="nearby-services-title"
          className="text-base font-extrabold tracking-[-0.02em]"
        >
          {title}
        </h2>
        <Link
          href={actionHref}
          className="text-terracotta consumer-pressable hover:bg-brand-orange/[0.08] inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold"
        >
          Ver todo
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
      <ul
        className={
          layout === "stack"
            ? "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            : "consumer-scrollbar-none consumer-snap-rail -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        }
      >
        {rows.map((row) => (
          <li
            key={`${row.provider_slug}/${row.service_slug}`}
            className={
              layout === "stack" ? undefined : "w-[min(84vw,22rem)] shrink-0"
            }
          >
            <ServiceCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
