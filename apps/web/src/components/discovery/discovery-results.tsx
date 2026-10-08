"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getManualLocation, type DiscoveryFilters } from "@changas/domain";

import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { actionButtonClass } from "@/components/ui/marketplace/action-button";
import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";
import { riseStyle } from "@/lib/ui/motion";
import { readStoredLocation } from "./location-picker";
import { DiscoveryCard } from "./discovery-card";

function nullableFiniteNumber(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isDiscoveryRow(
  value: unknown,
): value is ReputationDiscoveryServiceRow {
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

function rowKey(row: ReputationDiscoveryServiceRow): string {
  return `${row.provider_slug}/${row.service_slug}`;
}

function mergeRows(
  current: ReputationDiscoveryServiceRow[],
  incoming: ReputationDiscoveryServiceRow[],
): ReputationDiscoveryServiceRow[] {
  const known = new Set(current.map(rowKey));
  return [...current, ...incoming.filter((row) => !known.has(rowKey(row)))];
}

function signatureOf(query: string, filters: DiscoveryFilters): string {
  return JSON.stringify({ query, filters });
}

const DISCOVERY_COVERS = [
  { css: "linear-gradient(135deg, #FF9A3D 0%, #EE5A24 100%)", tone: "orange" },
  { css: "linear-gradient(135deg, #4F8DFF 0%, #2F4BFE 100%)", tone: "blue" },
  { css: "linear-gradient(135deg, #2FBF71 0%, #0E7C46 100%)", tone: "green" },
  { css: "linear-gradient(135deg, #FB6F92 0%, #E14D7A 100%)", tone: "rose" },
  { css: "linear-gradient(135deg, #8B7CFF 0%, #5B4BD6 100%)", tone: "violet" },
  { css: "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)", tone: "gold" },
] as const;

function coverForDiscovery(key: string | null): (typeof DISCOVERY_COVERS)[number] {
  if (!key) return DISCOVERY_COVERS[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return DISCOVERY_COVERS[hash % DISCOVERY_COVERS.length] ?? DISCOVERY_COVERS[0];
}

function LoadingSkeletons() {
  return (
    <div aria-hidden="true" className="mt-3 grid gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="border-ink/[0.07] bg-surface consumer-card animate-pulse overflow-hidden rounded-[1.25rem] border"
        >
          <div className="brand-gradient-surface relative h-16 overflow-hidden opacity-60">
            <span
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "10px 10px",
              }}
            />
            <span className="absolute -right-4 -bottom-6 h-20 w-20 rounded-full bg-white/20" />
          </div>
          <div className="p-5">
            <div className="bg-ink/[0.08] h-5 w-2/3 rounded-full" />
            <div className="bg-ink/[0.06] mt-3 h-4 w-1/2 rounded-full" />
            <div className="bg-ink/[0.06] mt-2 h-4 w-1/3 rounded-full" />
            <div className="mt-4 flex gap-2">
              <div className="bg-ink/[0.08] h-11 flex-1 rounded-xl" />
              <div className="bg-ink/[0.08] h-11 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [page, setPage] = useState(filters.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(
    initialError ? "No pudimos cargar los resultados." : null,
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [gpsMode, setGpsMode] = useState(false);
  const [gpsPage, setGpsPage] = useState(1);
  const [gpsPoint, setGpsPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const signatureRef = useRef<string | null>(null);
  const signature = JSON.stringify([query, filters]);
  // Id monotónico: las respuestas que llegan tarde se descartan para que un
  // request viejo no pise resultados más nuevos.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    // Invalida los requests en vuelo: sus respuestas se descartan al llegar.
    requestIdRef.current += 1;
    setRows(initialRows);
    setHasMore(initialHasMore);
    setPage(filters.page);
    setLoadingMore(false);
    setLoadError(null);
    setResultsError(initialError ? "No pudimos cargar los resultados." : null);
    setGpsMode(false);
    setGpsPage(1);
    setGpsPoint(null);
  }, [signature, initialRows, initialHasMore, initialError, filters.page]);

  const requestDiscoveryPage = useCallback(
    async function requestDiscoveryPage(
      nextPage: number,
      point: { latitude: number; longitude: number } | null,
    ) {
      const body: Record<string, unknown> = {
        query,
        filters: { ...filters, page: nextPage },
      };
      if (point) {
        body.latitude = point.latitude;
        body.longitude = point.longitude;
      }
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error("discovery request failed");
      }
      const rowsCandidate = "rows" in payload ? payload.rows : undefined;
      const nextRows = Array.isArray(rowsCandidate)
        ? rowsCandidate.filter(isDiscoveryRow)
        : [];
      return {
        nextRows,
        hasMore: "hasMore" in payload ? payload.hasMore === true : false,
      };
    },
    [filters, query],
  );

  const fetchNearbyPage = useCallback(
    async function fetchNearbyPage(
      nextPage: number,
      point: { latitude: number; longitude: number },
    ) {
      setGpsPoint(point);
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const append = nextPage > 1;
      if (append) {
        setLoadingMore(true);
        setLoadError(null);
      } else {
        setNearbyLoading(true);
        setResultsError(null);
      }
      try {
        const { nextRows, hasMore: more } = await requestDiscoveryPage(
          nextPage,
          point,
        );
        if (requestIdRef.current !== requestId) return;
        setRows((current) =>
          append ? mergeRows(current, nextRows) : nextRows,
        );
        setHasMore(more);
        setGpsPage(nextPage);
        setGpsMode(true);
        setResultsError(null);
        setLoadError(null);
      } catch {
        if (requestIdRef.current !== requestId) return;
        if (append) {
          setLoadError(
            "No pudimos cargar más resultados cerca tuyo. Probá de nuevo.",
          );
        } else {
          setResultsError("No pudimos cargar los resultados cerca tuyo.");
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setNearbyLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [requestDiscoveryPage],
  );

  const loadMore = useCallback(
    function loadMore() {
      if (loadingMore || nearbyLoading || !hasMore) return;
      if (gpsMode && gpsPoint) {
        void fetchNearbyPage(gpsPage + 1, gpsPoint);
        return;
      }
      const manual = getManualLocation(filters.locationSlug);
      const point = manual
        ? { latitude: manual.latitude, longitude: manual.longitude }
        : null;
      const nextPage = page + 1;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoadingMore(true);
      setLoadError(null);
      void requestDiscoveryPage(nextPage, point)
        .then(({ nextRows, hasMore: more }) => {
          if (requestIdRef.current !== requestId) return;
          setRows((current) => mergeRows(current, nextRows));
          setHasMore(more);
          setPage(nextPage);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setLoadError("No pudimos cargar más resultados. Probá de nuevo.");
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoadingMore(false);
        });
    },
    [
      fetchNearbyPage,
      filters.locationSlug,
      gpsMode,
      gpsPoint,
      gpsPage,
      hasMore,
      loadingMore,
      nearbyLoading,
      page,
      requestDiscoveryPage,
    ],
  );

  useEffect(() => {
    if (!enableNearby || gpsMode) return;
    const value = readStoredLocation();
    if (
      !value ||
      typeof value.latitude !== "number" ||
      !Number.isFinite(value.latitude) ||
      typeof value.longitude !== "number" ||
      !Number.isFinite(value.longitude)
    ) {
      return;
    }
    const point = { latitude: value.latitude, longitude: value.longitude };
    const request = window.setTimeout(() => {
      void fetchNearbyPage(1, point);
    }, 0);
    return () => window.clearTimeout(request);
  }, [enableNearby, fetchNearbyPage, gpsMode]);

  function searchNearby() {
    if (!navigator.geolocation) {
      setResultsError("Tu navegador no ofrece geolocalización.");
      return;
    }
    setNearbyLoading(true);
    setResultsError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        void fetchNearbyPage(1, point);
      },
      () => {
        setResultsError(
          "No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.",
        );
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  const activeCover = coverForDiscovery(filters.categorySlug ?? filters.skillSlug ?? query ?? null);
  return (
    <section
      aria-label="Resultados de búsqueda"
      aria-busy={loadingMore || nearbyLoading}
    >
      <SectionHeader title="Resultados" badge={{ tone: "orange", icon: "star", label: "Resultados de búsqueda" }} />
      <div className="mt-1 flex min-h-12 flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          role="status"
          className={`text-sm font-semibold ${resultsError ? "text-danger" : "text-ink/75"} ${!resultsError && rows.length === 0 ? "sr-only" : ""}`}
        >
          {resultsError
            ? resultsError
            : rows.length === 0
              ? "No encontramos servicios con esos criterios."
              : `${rows.length} resultado${rows.length === 1 ? "" : "s"}${hasMore ? "+" : ""}`}
        </p>
        {enableNearby ? (
          <button
            className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.08] inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold"
            type="button"
            onClick={searchNearby}
            disabled={nearbyLoading}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {nearbyLoading
              ? "Buscando…"
              : gpsMode
                ? "Actualizar ubicación"
                : "Cerca mío"}
          </button>
        ) : null}
      </div>

      {rows.length > 0 && !resultsError ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((row, index) => (
            <div key={rowKey(row)} className="rise-in" style={riseStyle(index)}>
              <DiscoveryCard row={row} />
            </div>
          ))}
        </div>
      ) : !resultsError ? (
        <div className="border-ink/[0.08] bg-surface consumer-card mt-3 overflow-hidden rounded-[1.25rem] border">
          <div
            className="relative flex h-24 items-end overflow-hidden p-4"
            style={{ backgroundImage: activeCover.css }}
            role="presentation"
          >
            <span
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "12px 12px",
              }}
              aria-hidden="true"
            />
            <span
              className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-white/20"
              aria-hidden="true"
            />
            <span
              className="absolute -top-6 -left-6 h-16 w-16 rounded-full bg-white/15"
              aria-hidden="true"
            />
            <span className="relative">
              <IllustratedBadge tone={activeCover.tone} icon="search" size="md" label="Sin resultados" />
            </span>
          </div>
          <EmptyState
            className="py-10"
            title="Probá otra búsqueda"
            description="Podés cambiar la categoría, la zona o elegir servicios remotos."
            actionHref="/buscar"
            actionLabel="Limpiar filtros"
            actionTone="secondary"
          />
        </div>
      ) : null}

      {loadingMore && !resultsError ? <LoadingSkeletons /> : null}

      {!resultsError ? (
        <nav
          aria-label={gpsMode ? "Más resultados cercanos" : "Más resultados"}
          className="mt-6 grid gap-2"
        >
          <p className="text-ink/75 text-center text-[13px] font-medium">
            Página {gpsMode ? gpsPage : page}
            {hasMore
              ? " · hay más para explorar"
              : rows.length > 0
                ? " · llegaste al final"
                : ""}
          </p>
          {loadingMore ? (
            <p
              role="status"
              className="text-ink/75 text-center text-[13px] font-semibold"
            >
              Cargando más resultados…
            </p>
          ) : null}
          {loadError ? (
            <div className="grid gap-2">
              <p
                role="alert"
                className="text-danger text-center text-sm font-semibold"
              >
                {loadError}
              </p>
              <button
                className={actionButtonClass(
                  "secondary",
                  "min-h-[52px] w-full text-[15px]",
                )}
                type="button"
                onClick={loadMore}
              >
                Reintentar
              </button>
            </div>
          ) : hasMore ? (
            <button
              className={actionButtonClass(
                "secondary",
                "min-h-[52px] w-full text-[15px]",
              )}
              type="button"
              onClick={loadMore}
              disabled={loadingMore || nearbyLoading}
            >
              {loadingMore || nearbyLoading ? "Cargando…" : "Cargar más"}
            </button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
