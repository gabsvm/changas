"use client";

import { useState } from "react";

import { minorUnitsToMajorInput, type DiscoveryFilters } from "@changas/domain";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import { BottomSheet } from "@/components/ui/marketplace/bottom-sheet";
import { marketplaceInputClass } from "@/components/ui/marketplace/form-field";

export function SearchFiltersSheet({
  query,
  filters,
  categories,
  skills,
  activeCount = 0,
}: {
  query: string;
  filters: DiscoveryFilters;
  categories: Array<{ slug: string; name: string }>;
  skills: Array<{ slug: string; name: string }>;
  activeCount?: number;
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
        className="consumer-pressable border-ink/[0.1] text-ink inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-[15px] font-bold sm:w-auto"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
        >
          <path
            d="M4 7h16M7 12h10M10 17h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Filtros
        {activeCount > 0 ? (
          <span className="bg-ink text-surface grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-extrabold">
            {activeCount}
          </span>
        ) : null}
      </button>

      <BottomSheet open={open} title="Filtros" onClose={() => setOpen(false)}>
        <form action="/buscar" className="mt-2 grid gap-6 sm:grid-cols-2">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {filters.locationSlug ? (
            <input type="hidden" name="location" value={filters.locationSlug} />
          ) : null}

          <FilterGroup title="Qué buscás">
            <FilterField label="Categoría">
              <select
                className={marketplaceInputClass}
                defaultValue={filters.categorySlug ?? ""}
                name="category"
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Habilidad">
              <select
                className={marketplaceInputClass}
                defaultValue={filters.skillSlug ?? ""}
                name="skill"
              >
                <option value="">Todas</option>
                {skills.map((skill) => (
                  <option key={skill.slug} value={skill.slug}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </FilterField>
          </FilterGroup>

          <FilterGroup title="Dónde y cómo">
            <FilterField label="Modalidad">
              <select
                className={marketplaceInputClass}
                defaultValue={modeValue}
                name="mode"
              >
                <option value="todos">Todos</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
              </select>
            </FilterField>

            <FilterField label="Radio">
              <select
                className={marketplaceInputClass}
                defaultValue={String(filters.radiusMeters ?? "")}
                name="radius"
              >
                <option value="">Predeterminado</option>
                <option value="5000">Hasta 5 km</option>
                <option value="10000">Hasta 10 km</option>
                <option value="25000">Hasta 25 km</option>
              </select>
            </FilterField>
          </FilterGroup>

          <FilterGroup title="Precio">
            <FilterField label="Modelo de precio">
              <select
                className={marketplaceInputClass}
                defaultValue={filters.priceModel ?? ""}
                name="priceModel"
              >
                <option value="">Todos</option>
                <option value="FIXED">Precio fijo</option>
                <option value="STARTING_AT">Desde</option>
                <option value="HOURLY">Por hora</option>
                <option value="PER_UNIT">Por unidad</option>
                <option value="QUOTE">A cotizar</option>
              </select>
            </FilterField>

            <div className="grid grid-cols-2 gap-4">
              <FilterField label="Desde">
                <input
                  className={marketplaceInputClass}
                  defaultValue={minorUnitsToMajorInput(filters.minPrice)}
                  min="0.01"
                  name="min"
                  step="0.01"
                  type="number"
                  inputMode="decimal"
                  aria-label="Precio desde"
                />
              </FilterField>

              <FilterField label="Hasta">
                <input
                  className={marketplaceInputClass}
                  defaultValue={minorUnitsToMajorInput(filters.maxPrice)}
                  min="0.01"
                  name="max"
                  step="0.01"
                  type="number"
                  inputMode="decimal"
                  aria-label="Precio hasta"
                />
              </FilterField>
            </div>

            <label className="border-ink/[0.08] flex min-h-12 items-center gap-3 rounded-xl border px-3">
              <input
                className="accent-brand-orange h-5 w-5"
                defaultChecked={filters.acceptsOffers === true}
                name="offers"
                type="checkbox"
                value="true"
              />
              <span className="text-sm font-semibold">
                Sólo servicios que aceptan ofertas
              </span>
            </label>
          </FilterGroup>

          <FilterGroup title="Orden">
            <FilterField label="Ordenar">
              <select
                className={marketplaceInputClass}
                defaultValue={filters.sort}
                name="sort"
              >
                <option value="recommended">Recomendados</option>
                <option value="best-rated">Mejor calificados</option>
                <option value="most-completed">Más trabajos completados</option>
                <option value="nearest">Más cercanos</option>
                <option value="price-asc">Precio menor</option>
                <option value="price-desc">Precio mayor</option>
              </select>
            </FilterField>
          </FilterGroup>

          <div className="border-ink/[0.07] bg-surface/95 mobile-safe-bottom sticky bottom-0 -mx-4 mt-1 flex gap-2 border-t px-4 pt-3 backdrop-blur sm:static sm:col-span-2 sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
            <a
              href={
                query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar"
              }
              className="consumer-pressable border-ink/10 inline-flex min-h-[52px] flex-1 items-center justify-center rounded-xl border bg-white px-4 text-[15px] font-bold"
            >
              Limpiar
            </a>
            <ActionButton
              className="min-h-[52px] flex-[2] text-[15px]"
              type="submit"
            >
              Ver resultados
            </ActionButton>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="text-ink/48 mb-1 text-[0.68rem] font-bold tracking-[0.1em] uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-ink text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
