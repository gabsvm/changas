"use client";

import { useState } from "react";

import { minorUnitsToMajorInput, type DiscoveryFilters } from "@changas/domain";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import { marketplaceInputClass } from "@/components/ui/marketplace/form-field";

export function SearchFiltersSheet({
  query,
  filters,
  categories,
  skills,
}: {
  query: string;
  filters: DiscoveryFilters;
  categories: Array<{ slug: string; name: string }>;
  skills: Array<{ slug: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const modeValue =
    filters.modality === "IN_PERSON"
      ? "presencial"
      : filters.modality === "REMOTE"
        ? "remoto"
        : "todos";

  return (
    <>
      <button
        type="button"
        className="consumer-pressable border-ink/10 inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3.5 text-sm font-bold text-ink"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none">
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Filtros
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Filtros de búsqueda">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Cerrar filtros"
            onClick={() => setOpen(false)}
          />
          <section className="mobile-safe-bottom relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.25rem] bg-surface px-4 pb-4 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.16)] sm:max-w-xl sm:rounded-2xl sm:p-5">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden="true" />
            <div className="flex min-h-12 items-center justify-between gap-4">
              <h2 className="text-lg font-bold tracking-[-0.02em]">Filtros</h2>
              <button
                type="button"
                className="consumer-pressable grid h-11 w-11 place-items-center rounded-full text-2xl text-ink/55 hover:bg-ink/[0.05]"
                onClick={() => setOpen(false)}
                aria-label="Cerrar filtros"
              >
                ×
              </button>
            </div>

            <form action="/buscar" className="mt-2 grid gap-4 sm:grid-cols-2">
              {query ? <input type="hidden" name="q" value={query} /> : null}
              {filters.locationSlug ? <input type="hidden" name="location" value={filters.locationSlug} /> : null}

              <FilterField label="Categoría">
                <select className={marketplaceInputClass} defaultValue={filters.categorySlug ?? ""} name="category">
                  <option value="">Todas</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Habilidad">
                <select className={marketplaceInputClass} defaultValue={filters.skillSlug ?? ""} name="skill">
                  <option value="">Todas</option>
                  {skills.map((skill) => (
                    <option key={skill.slug} value={skill.slug}>{skill.name}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Modalidad">
                <select className={marketplaceInputClass} defaultValue={modeValue} name="mode">
                  <option value="todos">Todos</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                </select>
              </FilterField>

              <FilterField label="Ordenar">
                <select className={marketplaceInputClass} defaultValue={filters.sort} name="sort">
                  <option value="recommended">Recomendados</option>
                  <option value="best-rated">Mejor calificados</option>
                  <option value="most-completed">Más trabajos completados</option>
                  <option value="nearest">Más cercanos</option>
                  <option value="price-asc">Precio menor</option>
                  <option value="price-desc">Precio mayor</option>
                </select>
              </FilterField>

              <FilterField label="Modelo de precio">
                <select className={marketplaceInputClass} defaultValue={filters.priceModel ?? ""} name="priceModel">
                  <option value="">Todos</option>
                  <option value="FIXED">Precio fijo</option>
                  <option value="STARTING_AT">Desde</option>
                  <option value="HOURLY">Por hora</option>
                  <option value="PER_UNIT">Por unidad</option>
                  <option value="QUOTE">A cotizar</option>
                </select>
              </FilterField>

              <FilterField label="Radio">
                <select className={marketplaceInputClass} defaultValue={String(filters.radiusMeters ?? "")} name="radius">
                  <option value="">Predeterminado</option>
                  <option value="5000">Hasta 5 km</option>
                  <option value="10000">Hasta 10 km</option>
                  <option value="25000">Hasta 25 km</option>
                </select>
              </FilterField>

              <FilterField label="Precio desde">
                <input className={marketplaceInputClass} defaultValue={minorUnitsToMajorInput(filters.minPrice)} min="0.01" name="min" step="0.01" type="number" inputMode="decimal" />
              </FilterField>

              <FilterField label="Precio hasta">
                <input className={marketplaceInputClass} defaultValue={minorUnitsToMajorInput(filters.maxPrice)} min="0.01" name="max" step="0.01" type="number" inputMode="decimal" />
              </FilterField>

              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/[0.08] px-3 sm:col-span-2">
                <input
                  className="accent-brand-orange h-5 w-5"
                  defaultChecked={filters.acceptsOffers === true}
                  name="offers"
                  type="checkbox"
                  value="true"
                />
                <span className="text-sm font-semibold">Sólo servicios que aceptan ofertas</span>
              </label>

              <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t border-ink/[0.07] bg-surface/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:col-span-2 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
                <a href={query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar"} className="consumer-pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-ink/10 bg-white px-4 text-sm font-bold">
                  Limpiar
                </a>
                <ActionButton className="flex-1" type="submit">Aplicar filtros</ActionButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}
