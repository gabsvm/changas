import { DesktopNav } from "@/components/ui/marketplace/desktop-nav";
import Link from "next/link";
import type { Metadata } from "next";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { ExampleServices } from "@/components/discovery/example-services";
import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { LocationPicker } from "@/components/discovery/location-picker";
import { SearchFiltersSheet } from "@/components/discovery/search-filters-sheet";
import { BottomNav } from "@/components/ui/nav-with-counts";
import { AppHeader } from "@/components/ui/marketplace/app-header";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { searchDiscovery } from "@/lib/discovery/server";
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

  const activeFilterCount =
    (filters.categorySlug ? 1 : 0) +
    (filters.skillSlug ? 1 : 0) +
    (filters.modality ? 1 : 0) +
    (filters.priceModel ? 1 : 0) +
    (filters.acceptsOffers ? 1 : 0) +
    (filters.sort !== "recommended" ? 1 : 0);

  // No published services at all (not just no matches for a filter).
  const marketplaceIsEmpty =
    rows.length === 0 &&
    !searchResult.error &&
    query === "" &&
    activeFilterCount === 0 &&
    filters.page === 1;

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

  function categoryHref(slug: string | null): string {
    const base = clearHref(["category"]);
    if (!slug) return base;
    return `${base}${base.includes("?") ? "&" : "?"}category=${encodeURIComponent(slug)}`;
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
          desktopNav={<DesktopNav authenticated={Boolean(user)} />}
          action={
            <Link
              href={user ? "/account" : "/login"}
              className={`consumer-pressable text-ink/75 hover:bg-ink/[0.04] inline-flex min-h-12 items-center rounded-full px-3 text-sm font-bold ${user ? "sm:hidden" : ""}`}
            >
              {user ? "Cuenta" : "Ingresar"}
            </Link>
          }
        />

        <section className="pt-3 sm:pt-8">
          <div className="brand-gradient-surface text-ink relative overflow-hidden rounded-3xl p-5 shadow-[var(--consumer-shadow-hero)] sm:p-6">
            <span
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "12px 12px",
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/20"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/15"
              aria-hidden="true"
            />
            <h1 className="relative z-10 text-[22px] leading-8 font-extrabold tracking-[-0.025em] sm:text-3xl sm:leading-10">
              {query ? `Resultados para “${query}”` : "Explorar servicios"}
            </h1>
            <form action="/buscar" className="relative z-10 mt-4">
              <div className="grid gap-3">
                <SearchField
                  defaultValue={query}
                  id="search-query"
                  name="q"
                  placeholder="Electricista, clases de inglés…"
                  aria-label="Buscar un servicio o habilidad"
                />
                <LocationPicker compact selected={filters.locationSlug} />
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchFiltersSheet
                      query={query}
                      filters={filters}
                      categories={categories}
                      skills={skills}
                      activeCount={activeFilterCount}
                    />
                  </div>
                  <button
                    className="consumer-pressable cta-ink inline-flex min-h-12 shrink-0 items-center rounded-2xl px-7 text-[15px] font-extrabold"
                    type="submit"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </form>

            {categories.length ? (
              <nav
                aria-label="Categorías"
                className="consumer-scrollbar-none relative z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                {[{ slug: null, name: "Todas" }, ...categories].map((item) => {
                  const selected =
                    (item.slug ?? "") === (filters.categorySlug ?? "");
                  return (
                    <Link
                      key={item.slug ?? "all"}
                      href={categoryHref(item.slug)}
                      aria-current={selected ? "true" : undefined}
                      className={`consumer-pressable inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-all duration-200 ${
                        selected
                          ? "border-transparent bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_48%,#FF0A78_100%)] text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)]"
                          : "border-white/60 bg-white/70 text-ink/80 backdrop-blur-sm hover:bg-white dark:border-white/10 dark:bg-[#2a231c] dark:text-[#f5efe8]"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            <div
              className="consumer-scrollbar-none relative z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
              role="group"
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
                <p className="text-ink/75 py-1 text-[13px] leading-5">
                  Usá los filtros para afinar por zona, modalidad o precio.
                </p>
              ) : null}
            </div>
          </div>

          <div className="discovery-results-shell mt-5">
            {marketplaceIsEmpty ? (
              <ExampleServices
                publishHref={
                  user
                    ? "/provider/onboarding"
                    : "/login?next=/provider/onboarding"
                }
              />
            ) : (
              <DiscoveryResults
                initialError={searchResult.error}
                initialHasMore={hasMore}
                initialRows={rows}
                query={query}
                filters={filters}
              />
            )}
          </div>
        </section>
      </div>
      <BottomNav authenticated={Boolean(user)} />
    </main>
  );
}
