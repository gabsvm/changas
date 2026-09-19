import Link from "next/link";
import type { Metadata } from "next";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { LocationPicker } from "@/components/discovery/location-picker";
import { SearchFiltersSheet } from "@/components/discovery/search-filters-sheet";
import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { AppHeader } from "@/components/ui/marketplace/app-header";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { searchDiscovery } from "@/lib/discovery/server";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Buscar servicios",
  description: "Explorá servicios y habilidades publicados en Changas.",
  alternates: { canonical: "/buscar" },
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = normalizeDiscoveryQuery(stringParam(params.q));
  const filters = parseDiscoveryFilters({
    category: stringParam(params.category) || undefined,
    location: stringParam(params.location) || undefined,
    max: stringParam(params.max) || undefined,
    min: stringParam(params.min) || undefined,
    mode: stringParam(params.mode) || undefined,
    offers: stringParam(params.offers) || undefined,
    page: stringParam(params.page) || undefined,
    pageSize: stringParam(params.pageSize) || undefined,
    priceModel: stringParam(params.priceModel) || undefined,
    radius: stringParam(params.radius) || undefined,
    skill: stringParam(params.skill) || undefined,
    sort: stringParam(params.sort) || undefined,
  });
  const supabase = await createClient();
  const [
    searchResult,
    categoriesResult,
    skillsResult,
    {
      data: { user },
    },
  ] = await Promise.all([
    searchDiscovery({ query, filters }, supabase),
    supabase
      .from("categories")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("skills")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.auth.getUser(),
  ]);
  const { rows, hasMore } = searchResult;
  const categories = categoriesResult.data ?? [];
  const skills = skillsResult.data ?? [];
  const activeCategory = categories.find(
    (item) => item.slug === filters.categorySlug,
  )?.name;
  const activeSkill = skills.find(
    (item) => item.slug === filters.skillSlug,
  )?.name;
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;

  const activeFilterCount =
    (filters.categorySlug ? 1 : 0) +
    (filters.skillSlug ? 1 : 0) +
    (filters.modality ? 1 : 0) +
    (filters.priceModel ? 1 : 0) +
    (filters.acceptsOffers ? 1 : 0) +
    (filters.sort !== "recommended" ? 1 : 0);

  function clearHref(omit: string[]): string {
    const entries: Array<[string, string]> = [
      ["q", query],
      ["category", stringParam(params.category)],
      ["skill", stringParam(params.skill)],
      ["location", stringParam(params.location)],
      ["mode", stringParam(params.mode)],
      ["offers", stringParam(params.offers) === "true" ? "true" : ""],
      ["min", stringParam(params.min)],
      ["max", stringParam(params.max)],
      ["radius", stringParam(params.radius)],
      ["priceModel", stringParam(params.priceModel)],
      ["sort", stringParam(params.sort)],
    ];
    const next = new URLSearchParams();
    for (const [key, value] of entries) {
      if (value && !omit.includes(key)) next.set(key, value);
    }
    const queryString = next.toString();
    return queryString ? `/buscar?${queryString}` : "/buscar";
  }

  return (
    <main
      id="main-content"
      className="bg-canvas text-ink mobile-content-with-nav min-h-screen"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8 sm:pt-5">
        <AppHeader
          backHref="/"
          title={query ? `“${query}”` : "Buscar"}
          action={
            <Link
              href={user ? "/account" : "/login"}
              className="consumer-pressable text-ink/60 hover:bg-ink/[0.04] inline-flex min-h-12 items-center rounded-full px-3 text-sm font-bold"
            >
              {user ? "Cuenta" : "Ingresar"}
            </Link>
          }
        />

        <section className="pt-3 sm:pt-8">
          <div className="discovery-hero border-ink/[0.07] bg-surface rounded-[1.25rem] border p-5 shadow-[var(--consumer-shadow-card)] sm:p-6">
            <h1 className="text-[22px] leading-8 font-extrabold tracking-[-0.025em] sm:text-3xl sm:leading-10">
              {query ? `Resultados para “${query}”` : "Explorar servicios"}
            </h1>

            <form action="/buscar" className="mt-4">
              <div className="grid gap-3">
                <SearchField
                  defaultValue={query}
                  id="search-query"
                  name="q"
                  placeholder="Electricista, clases de inglés…"
                  aria-label="Buscar un servicio o habilidad"
                />
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <LocationPicker compact selected={filters.locationSlug} />
                  </div>
                  <button
                    className="consumer-pressable bg-brand-orange text-ink inline-flex min-h-[52px] shrink-0 items-center rounded-2xl px-5 text-[15px] font-extrabold"
                    type="submit"
                  >
                    Buscar
                  </button>
                </div>
                <SearchFiltersSheet
                  query={query}
                  filters={filters}
                  categories={categories}
                  skills={skills}
                  activeCount={activeFilterCount}
                />
              </div>
            </form>

            <div
              className="consumer-scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
              aria-label="Filtros activos"
            >
              {activeCategory ? (
                <Link
                  href={clearHref(["category"])}
                  aria-label={`Quitar filtro de categoría ${activeCategory}`}
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="brand">
                    {activeCategory}
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {activeSkill ? (
                <Link
                  href={clearHref(["skill"])}
                  aria-label={`Quitar filtro de habilidad ${activeSkill}`}
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="neutral">
                    {activeSkill}
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {filters.modality === "REMOTE" ? (
                <Link
                  href={clearHref(["mode"])}
                  aria-label="Quitar filtro de modalidad remoto"
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="info">
                    Remoto
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {filters.modality === "IN_PERSON" ? (
                <Link
                  href={clearHref(["mode"])}
                  aria-label="Quitar filtro de modalidad presencial"
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="info">
                    Presencial
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {filters.acceptsOffers ? (
                <Link
                  href={clearHref(["offers"])}
                  aria-label="Quitar filtro de acepta ofertas"
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="brand">
                    Acepta ofertas
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {filters.sort !== "recommended" ? (
                <Link
                  href={clearHref(["sort"])}
                  aria-label="Quitar orden personalizado"
                  className="consumer-pressable shrink-0 rounded-full"
                >
                  <StatusChip tone="neutral">
                    Orden personalizado
                    <span
                      aria-hidden="true"
                      className="ml-1.5 text-sm leading-none"
                    >
                      ×
                    </span>
                  </StatusChip>
                </Link>
              ) : null}
              {activeFilterCount === 0 ? (
                <p className="text-ink/55 py-1 text-[13px] leading-5">
                  Usá los filtros para afinar por zona, modalidad o precio.
                </p>
              ) : null}
            </div>
          </div>

          <div className="discovery-results-shell mt-5">
            <DiscoveryResults
              initialError={searchResult.error}
              initialHasMore={hasMore}
              initialRows={rows}
              query={query}
              filters={filters}
            />
          </div>
        </section>
      </div>
      <AuthenticatedBottomNav unreadCount={unreadCount} />
    </main>
  );
}
