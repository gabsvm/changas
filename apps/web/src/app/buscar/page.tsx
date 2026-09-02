import Link from "next/link";
import type { Metadata } from "next";

import {
  minorUnitsToMajorInput,
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
} from "@changas/domain";

import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { LocationPicker } from "@/components/discovery/location-picker";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Buscar servicios",
  description: "Explorá servicios y habilidades publicados en Changas.",
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
  const modeValue =
    filters.modality === "IN_PERSON"
      ? "presencial"
      : filters.modality === "REMOTE"
        ? "remoto"
        : "todos";

  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-semibold">Changas</span>
          </Link>
          <Link
            className="text-ink/65 text-sm underline underline-offset-4"
            href="/login"
          >
            Ingresar
          </Link>
        </header>

        <section className="py-10 sm:py-14">
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Descubrimiento público
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            {query ? "Resultados para “" + query + "”" : "Todos los servicios"}
          </h1>
          <form
            action="/buscar"
            className="border-ink/10 mt-8 grid gap-4 rounded-2xl border bg-white/70 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <div>
              <label
                className="text-ink/65 text-sm font-semibold"
                htmlFor="search-query"
              >
                ¿Qué necesitás?
              </label>
              <input
                className="border-ink/15 focus:border-terracotta focus:ring-terracotta/30 mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2"
                defaultValue={query}
                id="search-query"
                name="q"
                placeholder="Ej. instalar camara"
                type="search"
              />
            </div>
            <LocationPicker compact selected={filters.locationSlug} />
            <button className="button-primary min-h-11" type="submit">
              Actualizar
            </button>
            <div className="border-ink/10 grid gap-3 border-t pt-4 sm:col-span-3 sm:grid-cols-4 lg:grid-cols-6">
              <div>
                <label
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-category"
                >
                  Categoría
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-skill"
                >
                  Habilidad
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-mode"
                >
                  Modalidad
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
                  defaultValue={modeValue}
                  id="search-mode"
                  name="mode"
                >
                  <option value="todos">Todos</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                </select>
              </div>
              <div>
                <label
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-sort"
                >
                  Ordenar
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-price-model"
                >
                  Modelo de precio
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-min"
                >
                  Precio desde
                </label>
                <input
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-max"
                >
                  Precio hasta
                </label>
                <input
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
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
                  className="text-ink/65 text-xs font-semibold"
                  htmlFor="search-radius"
                >
                  Radio
                </label>
                <select
                  className="border-ink/15 mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm"
                  defaultValue={String(filters.radiusMeters ?? "")}
                  id="search-radius"
                  name="radius"
                >
                  <option value="">Predeterminado</option>
                  <option value="5000">Hasta 5 km</option>
                  <option value="10000">Hasta 10 km</option>
                  <option value="25000">Hasta 25 km</option>
                </select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex min-h-10 items-center gap-2">
                  <input
                    defaultChecked={filters.acceptsOffers === true}
                    id="search-offers"
                    name="offers"
                    type="checkbox"
                    value="true"
                  />
                  <label
                    className="text-ink/65 text-xs font-semibold"
                    htmlFor="search-offers"
                  >
                    Acepta ofertas
                  </label>
                </div>
              </div>
            </div>
          </form>

          <div className="mt-8">
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
