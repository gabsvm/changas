import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { DiscoveryPagination } from "@/components/discovery/discovery-pagination";
import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { AppHeader } from "@/components/ui/marketplace/app-header";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getCategory(slug: string) {
  const supabase = await createClient();
  return supabase
    .from("categories")
    .select("slug, name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: category } = await getCategory(slug);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description:
      category.description ?? "Servicios y habilidades publicados en Changas.",
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: {
      title: `${category.name} · Changas`,
      description:
        category.description ??
        "Servicios y habilidades publicados en Changas.",
      type: "website",
      url: `/categoria/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const { data: category } = await getCategory(slug);
  if (!category) notFound();
  const categorySlug = category.slug;
  const pageParam = Array.isArray(queryParams.page)
    ? queryParams.page[0]
    : queryParams.page;
  const pageSizeParam = Array.isArray(queryParams.pageSize)
    ? queryParams.pageSize[0]
    : queryParams.pageSize;
  const raw: Record<string, string> = {};
  for (const key of ["q", "mode", "offers", "sort"]) {
    const value = queryParams[key];
    const text = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
    if (text) raw[key] = text;
  }
  const query = normalizeDiscoveryQuery(raw.q ?? "");
  const filters = parseDiscoveryFilters({
    category: categorySlug,
    mode: raw.mode || undefined,
    offers: raw.offers || undefined,
    sort: raw.sort || undefined,
    page: pageParam,
    pageSize: pageSizeParam,
  });
  const searchResult = await searchDiscovery({ query, filters });

  function categoryHref(overrides: Record<string, string | null>): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...raw, ...overrides })) {
      if (value) next.set(key, value);
    }
    const queryString = next.toString();
    return queryString
      ? `/categoria/${categorySlug}?${queryString}`
      : `/categoria/${categorySlug}`;
  }

  function pageHref(page: number): string {
    return categoryHref({ page: String(page) });
  }
  const { rows, hasMore } = searchResult;

  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8 sm:pt-5">
        <AppHeader
          brand
          action={
            <Link
              className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.07] inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold"
              href="/buscar"
            >
              Buscar
            </Link>
          }
          className="sm:flex"
        />
        <section className="pt-5 sm:pt-9">
          <div className="discovery-hero border-brand-yellow/35 bg-surface-muted/55 rounded-[1.25rem] border p-5 shadow-[var(--consumer-shadow-card)] sm:p-6">
            <p className="brand-kicker text-xs font-extrabold tracking-[0.14em] uppercase">
              Explorá por categoría
            </p>
            <h1 className="mt-2 text-3xl leading-9 font-bold tracking-[-0.04em] sm:text-4xl">
              {category.name}
            </h1>
            {category.description ? (
              <p className="text-ink/58 mt-2 max-w-2xl text-sm leading-6 sm:text-base">
                {category.description}
              </p>
            ) : null}
            <Link
              href={
                query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar"
              }
              aria-label={`Quitar filtro de categoría ${category.name}`}
              className="consumer-pressable bg-brand-orange/12 text-terracotta mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold"
            >
              {category.name}
              <span aria-hidden="true" className="text-sm leading-none">
                ×
              </span>
            </Link>
            <form
              action={`/categoria/${categorySlug}`}
              className="mt-3 flex gap-2"
            >
              {raw.mode ? (
                <input type="hidden" name="mode" value={raw.mode} />
              ) : null}
              {raw.offers ? (
                <input type="hidden" name="offers" value={raw.offers} />
              ) : null}
              {raw.sort ? (
                <input type="hidden" name="sort" value={raw.sort} />
              ) : null}
              <div className="min-w-0 flex-1">
                <SearchField
                  id="category-query"
                  name="q"
                  defaultValue={query}
                  placeholder={`Buscar dentro de ${category.name}…`}
                  aria-label={`Buscar dentro de ${category.name}`}
                />
              </div>
              <button
                className="consumer-pressable bg-brand-orange text-ink inline-flex min-h-[52px] shrink-0 items-center rounded-2xl px-5 text-sm font-extrabold"
                type="submit"
              >
                Buscar
              </button>
            </form>
            <div
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Refinar por modalidad"
            >
              <Link
                href={categoryHref({
                  mode: filters.modality === "IN_PERSON" ? null : "presencial",
                })}
                aria-pressed={filters.modality === "IN_PERSON"}
                className={`consumer-pressable inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${
                  filters.modality === "IN_PERSON"
                    ? "bg-ink text-white"
                    : "border-ink/[0.08] border bg-white"
                }`}
              >
                Cerca mío
              </Link>
              <Link
                href={categoryHref({
                  mode: filters.modality === "REMOTE" ? null : "remoto",
                })}
                aria-pressed={filters.modality === "REMOTE"}
                className={`consumer-pressable inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${
                  filters.modality === "REMOTE"
                    ? "bg-ink text-white"
                    : "border-ink/[0.08] border bg-white"
                }`}
              >
                Remoto
              </Link>
              <Link
                href={categoryHref({
                  offers: filters.acceptsOffers ? null : "true",
                })}
                aria-pressed={filters.acceptsOffers === true}
                className={`consumer-pressable inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${
                  filters.acceptsOffers
                    ? "bg-ink text-white"
                    : "border-ink/[0.08] border bg-white"
                }`}
              >
                Acepta ofertas
              </Link>
            </div>
          </div>
          <p className="text-ink/42 mt-5 text-xs font-extrabold tracking-[0.12em] uppercase">
            Servicios publicados
          </p>
          <div className="discovery-results-shell mt-5">
            <DiscoveryResults
              enableNearby={false}
              initialError={searchResult.error}
              initialHasMore={hasMore}
              initialRows={rows}
              query={query}
              filters={filters}
            />
            {!searchResult.error ? (
              <DiscoveryPagination
                previousHref={
                  filters.page > 1 ? pageHref(filters.page - 1) : null
                }
                nextHref={hasMore ? pageHref(filters.page + 1) : null}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
