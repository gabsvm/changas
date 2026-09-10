import Link from "next/link";
import type { Metadata } from "next";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { LocationPicker } from "@/components/discovery/location-picker";
import { SearchFiltersSheet } from "@/components/discovery/search-filters-sheet";
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
    supabase.from("categories").select("slug, name").eq("is_active", true).order("sort_order"),
    supabase.from("skills").select("slug, name").eq("is_active", true).order("sort_order"),
    supabase.auth.getUser(),
  ]);
  const { rows, hasMore } = searchResult;
  const categories = categoriesResult.data ?? [];
  const skills = skillsResult.data ?? [];
  const activeCategory = categories.find((item) => item.slug === filters.categorySlug)?.name;
  const activeSkill = skills.find((item) => item.slug === filters.skillSlug)?.name;

  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8 sm:pt-5">
        <AppHeader
          brand
          action={
            <Link
              href={user ? "/account" : "/login"}
              className="consumer-pressable inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold text-ink/65 hover:bg-ink/[0.035] hover:text-ink"
            >
              {user ? "Mi cuenta" : "Ingresar"}
            </Link>
          }
          className="sm:flex"
        />

        <section className="pt-5 sm:pt-9">
          <div className="border-brand-yellow/35 bg-surface-muted/55 rounded-[1.75rem] border p-4 shadow-[var(--consumer-shadow-card)] sm:p-6">
          <p className="brand-kicker text-xs font-extrabold tracking-[0.14em] uppercase">Encontrá ayuda cerca tuyo</p>
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
            {query ? `Resultados para “${query}”` : "Explorar servicios"}
          </h1>

          <form action="/buscar" className="mt-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <SearchField
                defaultValue={query}
                id="search-query"
                name="q"
                placeholder="Buscar un servicio o habilidad"
                aria-label="Buscar un servicio o habilidad"
              />
              <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
                <LocationPicker compact selected={filters.locationSlug} />
                <button
                  className="consumer-pressable bg-brand-orange min-h-11 rounded-xl px-4 text-sm font-bold text-ink"
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
              />
            </div>
          </form>

          <div className="consumer-scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {activeCategory ? <StatusChip tone="brand">{activeCategory}</StatusChip> : null}
            {activeSkill ? <StatusChip tone="neutral">{activeSkill}</StatusChip> : null}
            {filters.modality === "REMOTE" ? <StatusChip tone="info">Remoto</StatusChip> : null}
            {filters.modality === "IN_PERSON" ? <StatusChip tone="info">Presencial</StatusChip> : null}
            {filters.acceptsOffers ? <StatusChip tone="brand">Acepta ofertas</StatusChip> : null}
            {filters.sort !== "recommended" ? <StatusChip tone="neutral">Orden personalizado</StatusChip> : null}
          </div>
          </div>

          <div className="mt-4">
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
    </main>
  );
}
