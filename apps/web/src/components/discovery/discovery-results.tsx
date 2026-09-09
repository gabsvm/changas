"use client";

import Link from "next/link";
import { useState } from "react";

import { minorUnitsToMajorInput, type DiscoveryFilters } from "@changas/domain";

import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { actionButtonClass } from "@/components/ui/marketplace/action-button";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";

import { DiscoveryCard } from "./discovery-card";

function nullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isDiscoveryRow(value: unknown): value is ReputationDiscoveryServiceRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ReputationDiscoveryServiceRow>;
  return (
    typeof row.provider_display_name === "string" &&
    typeof row.provider_slug === "string" &&
    typeof row.service_title === "string" &&
    typeof row.service_slug === "string" &&
    typeof row.category_name === "string" &&
    typeof row.skill_name === "string" &&
    typeof row.modality === "string" &&
    typeof row.price_model === "string" &&
    typeof row.currency_code === "string" &&
    typeof row.accepts_offers === "boolean" &&
    nullableFiniteNumber(row.rating_average) &&
    nullableFiniteNumber(row.adjusted_rating) &&
    typeof row.review_count === "number" &&
    Number.isFinite(row.review_count) &&
    typeof row.completed_jobs === "number" &&
    Number.isFinite(row.completed_jobs) &&
    nullableFiniteNumber(row.completion_rate) &&
    typeof row.repeat_client_count === "number" &&
    Number.isFinite(row.repeat_client_count) &&
    typeof row.has_more === "boolean"
  );
}

function searchHref(query: string, filters: DiscoveryFilters, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.skillSlug) params.set("skill", filters.skillSlug);
  if (filters.locationSlug) params.set("location", filters.locationSlug);
  if (filters.modality === "IN_PERSON") params.set("mode", "presencial");
  if (filters.modality === "REMOTE") params.set("mode", "remoto");
  if (filters.minPrice !== null) params.set("min", minorUnitsToMajorInput(filters.minPrice));
  if (filters.maxPrice !== null) params.set("max", minorUnitsToMajorInput(filters.maxPrice));
  if (filters.radiusMeters !== null) params.set("radius", String(filters.radiusMeters));
  if (filters.acceptsOffers === true) params.set("offers", "true");
  if (filters.priceModel) params.set("priceModel", filters.priceModel);
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.pageSize !== 24) params.set("pageSize", String(filters.pageSize));
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/buscar?${queryString}` : "/buscar";
}

export function DiscoveryResults({
  initialRows,
  initialHasMore = false,
  initialError = null,
  query,
  filters,
  enableNearby = true,
}: {
  initialRows: ReputationDiscoveryServiceRow[];
  initialHasMore?: boolean;
  initialError?: string | null;
  query: string;
  filters: DiscoveryFilters;
  enableNearby?: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [resultsError, setResultsError] = useState<string | null>(
    initialError ? "No pudimos cargar los resultados." : null,
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [gpsMode, setGpsMode] = useState(false);
  const [gpsPage, setGpsPage] = useState(1);
  const [gpsPoint, setGpsPoint] = useState<{ latitude: number; longitude: number } | null>(null);

  async function fetchNearbyPage(
    page: number,
    point: { latitude: number; longitude: number },
  ) {
    setNearbyLoading(true);
    setResultsError(null);
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          filters: { ...filters, page },
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error("discovery request failed");
      }
      const candidate = (payload as { rows?: unknown }).rows;
      const nextRows = Array.isArray(candidate) ? candidate.filter(isDiscoveryRow) : [];
      setRows(nextRows);
      setHasMore((payload as { hasMore?: unknown }).hasMore === true);
      setGpsPage(page);
      setGpsMode(true);
      setResultsError(null);
    } catch {
      setResultsError("No pudimos cargar los resultados cerca tuyo.");
    } finally {
      setNearbyLoading(false);
    }
  }

  function searchNearby() {
    if (!navigator.geolocation) {
      setResultsError("Tu navegador no ofrece geolocalización.");
      return;
    }
    setNearbyLoading(true);
    setResultsError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        setGpsPoint(point);
        void fetchNearbyPage(1, point);
      },
      () => {
        setResultsError("No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.");
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <section aria-live="polite" aria-label="Resultados de búsqueda">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className={`text-sm ${resultsError ? "text-danger" : "text-ink/55"}`}>
          {resultsError
            ? resultsError
            : rows.length === 0
              ? "No encontramos servicios con esos criterios."
              : `${rows.length} resultado${rows.length === 1 ? "" : "s"}`}
        </p>
        {enableNearby ? (
          <button
            className="consumer-pressable inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-terracotta hover:bg-brand-orange/[0.07]"
            type="button"
            onClick={searchNearby}
            disabled={nearbyLoading}
          >
            <span aria-hidden="true">⌖</span>
            {nearbyLoading ? "Buscando…" : "Cerca mío"}
          </button>
        ) : null}
      </div>

      {rows.length > 0 && !resultsError ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <DiscoveryCard key={`${row.provider_slug}/${row.service_slug}`} row={row} />
          ))}
        </div>
      ) : !resultsError ? (
        <EmptyState
          className="py-10"
          title="Probá otra búsqueda"
          description="Podés cambiar la categoría, la zona o elegir servicios remotos."
          actionHref="/buscar"
          actionLabel="Limpiar filtros"
          actionTone="secondary"
        />
      ) : null}

      {enableNearby && gpsMode && gpsPoint && !resultsError ? (
        <nav aria-label="Paginación de resultados cercanos" className="mt-6 flex items-center justify-between gap-3">
          {gpsPage > 1 ? (
            <button
              className={actionButtonClass("secondary")}
              type="button"
              onClick={() => void fetchNearbyPage(gpsPage - 1, gpsPoint)}
              disabled={nearbyLoading}
            >
              Anterior
            </button>
          ) : <span />}
          {hasMore ? (
            <button
              className={actionButtonClass("secondary")}
              type="button"
              onClick={() => void fetchNearbyPage(gpsPage + 1, gpsPoint)}
              disabled={nearbyLoading}
            >
              Siguiente
            </button>
          ) : null}
        </nav>
      ) : enableNearby && !resultsError ? (
        <nav aria-label="Paginación de resultados" className="mt-6 flex items-center justify-between gap-3">
          {filters.page > 1 ? (
            <Link className={actionButtonClass("secondary")} href={searchHref(query, filters, filters.page - 1)}>
              Anterior
            </Link>
          ) : <span />}
          {hasMore ? (
            <Link className={actionButtonClass("secondary")} href={searchHref(query, filters, filters.page + 1)}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
