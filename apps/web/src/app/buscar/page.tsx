import type { Metadata } from "next";

import {
  minorUnitsToMajorInput,
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { LocationPicker } from "@/components/discovery/location-picker";
import { MobileFilterPanel } from "@/components/discovery/mobile-filter-panel";
import { ConsumerShell } from "@/components/ui/consumer-shell";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";
import { countActiveDiscoveryFilters } from "@/lib/ui/discovery-filters";

export const metadata: Metadata = {
  title: "Buscar servicios",
  description: "Explorá servicios y habilidades publicados en Changas.",
  alternates: { canonical: "/buscar" },
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
  const [searchResult, categoriesResult, skillsResult] = await Promise.all([
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
  ]);
  const { rows, hasMore } = searchResult;
  const categories = categoriesResult.data ?? [];
  const skills = skillsResult.data ?? [];
  const activeFilterCount = countActiveDiscoveryFilters(filters);
  const modeValue =
    filters.modality === "IN_PERSON"
      ? "presencial"
      : filters.modality === "REMOTE"
        ? "remoto"
        : "todos";

  const controlClass =
    "border-ink/15 focus:border-moss focus:ring-moss/15 mt-1 min-h-12 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2";

  return (
    <ConsumerShell maxWidth="max-w-6xl">
      <section className="py-8 sm:py-14">
        <p className="product-kicker">Encontrá lo que necesitás</p>
        <h1 className="product-page-title mt-2">
          {query ? "Resultados para “" + query + "”" : "Buscar servicios"}
        </h1>

        <form
          action="/buscar"
          className="border-ink/10 bg-surface mt-6 grid gap-4 rounded-[1.6rem] border p-4 shadow-[0_14px_38px_rgba(32,33,36,0.05)] sm:mt-8 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:p-5"
        >
          <div>
            <label
              className="text-ink/65 text-sm font-bold"
              htmlFor="search-query"
            >
              ¿Qué necesitás?
            </label>
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/15 mt-2 min-h-12 w-full rounded-xl border bg-white px-4 text-base outline-none focus:ring-2"
              defaultValue={query}
              id="search-query"
              name="q"
              placeholder="Ej. electricista, instalar cámara…"
              type="search"
            />
          </div>
          <LocationPicker compact selected={filters.locationSlug} />
          <button className="button-primary min-h-12" type="submit">
            Buscar
          </button>

          <MobileFilterPanel activeCount={activeFilterCount}>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-category"
              >
                Categoría
              </label>
              <select
                className={controlClass}
                defaultValue={filters.categorySlug ?? ""}
                id="search-category"
                name="category"
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-skill"
              >
                Habilidad
              </label>
              <select
                className={controlClass}
                defaultValue={filters.skillSlug ?? ""}
                id="search-skill"
                name="skill"
              >
                <option value="">Todas</option>
                {skills.map((skill) => (
                  <option key={skill.slug} value={skill.slug}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-mode"
              >
                Modalidad
              </label>
              <select
                className={controlClass}
                defaultValue={modeValue}
                id="search-mode"
                name="mode"
              >
                <option value="todos">Todas</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
              </select>
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-sort"
              >
                Ordenar
              </label>
              <select
                className={controlClass}
                defaultValue={filters.sort}
                id="search-sort"
                name="sort"
              >
                <option value="recommended">Recomendados</option>
                <option value="best-rated">Mejor calificados</option>
                <option value="most-completed">Más trabajos completados</option>
                <option value="nearest">Más cercanos</option>
                <option value="price-asc">Precio menor</option>
                <option value="price-desc">Precio mayor</option>
              </select>
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-price-model"
              >
                Tipo de precio
              </label>
              <select
                className={controlClass}
                defaultValue={filters.priceModel ?? ""}
                id="search-price-model"
                name="priceModel"
              >
                <option value="">Todos</option>
                <option value="FIXED">Precio fijo</option>
                <option value="STARTING_AT">Desde</option>
                <option value="HOURLY">Por hora</option>
                <option value="PER_UNIT">Por unidad</option>
                <option value="QUOTE">A cotizar</option>
              </select>
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-min"
              >
                Precio desde
              </label>
              <input
                className={controlClass}
                defaultValue={minorUnitsToMajorInput(filters.minPrice)}
                id="search-min"
                min="0.01"
                name="min"
                placeholder="ARS"
                step="0.01"
                type="number"
              />
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-max"
              >
                Precio hasta
              </label>
              <input
                className={controlClass}
                defaultValue={minorUnitsToMajorInput(filters.maxPrice)}
                id="search-max"
                min="0.01"
                name="max"
                placeholder="ARS"
                step="0.01"
                type="number"
              />
            </div>
            <div>
              <label
                className="text-ink/65 text-xs font-bold"
                htmlFor="search-radius"
              >
                Distancia
              </label>
              <select
                className={controlClass}
                defaultValue={String(filters.radiusMeters ?? "")}
                id="search-radius"
                name="radius"
              >
                <option value="">Predeterminada</option>
                <option value="5000">Hasta 5 km</option>
                <option value="10000">Hasta 10 km</option>
                <option value="25000">Hasta 25 km</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex min-h-12 items-center gap-3 rounded-xl px-1 text-xs font-bold">
                <input
                  className="accent-terracotta h-5 w-5"
                  defaultChecked={filters.acceptsOffers === true}
                  name="offers"
                  type="checkbox"
                  value="true"
                />
                Acepta ofertas
              </label>
            </div>
            <div className="sm:hidden">
              <button className="button-primary w-full" type="submit">
                Aplicar filtros
              </button>
            </div>
          </MobileFilterPanel>
        </form>

        <div className="mt-7 sm:mt-8">
          <DiscoveryResults
            initialError={searchResult.error}
            initialHasMore={hasMore}
            initialRows={rows}
            query={query}
            filters={filters}
          />
        </div>
      </section>
    </ConsumerShell>
  );
}
