import { riseStyle } from "@/lib/ui/motion";
import Link from "next/link";

import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { ServiceCard } from "./service-card";

export function NearbyServiceRail({
  rows,
  title,
  actionHref,
}: {
  rows: ReputationDiscoveryServiceRow[];
  title: string;
  actionHref: string;
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
          className="text-terracotta consumer-pressable border-ink/[0.08] bg-surface inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm font-bold shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] hover:bg-brand-orange/[0.08] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
        >
          Ver todo
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
          >
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
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row, index) => (
          <li
            key={`${row.provider_slug}/${row.service_slug}`}
            style={riseStyle(index)}
            className="rise-in"
          >
            <ServiceCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
