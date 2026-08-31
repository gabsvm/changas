"use client";

import { useState } from "react";

import type { DiscoveryFilters } from "@changas/domain";

import type { DiscoveryServiceRow } from "@/lib/supabase/database.types";

import { DiscoveryCard } from "./discovery-card";

function isDiscoveryRow(value: unknown): value is DiscoveryServiceRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<DiscoveryServiceRow>;
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
    typeof row.accepts_offers === "boolean"
  );
}

export function DiscoveryResults({
  initialRows,
  query,
  filters,
}: {
  initialRows: DiscoveryServiceRow[];
  query: string;
  filters: DiscoveryFilters;
}) {
  const [rows, setRows] = useState(initialRows);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  async function searchNearby() {
    if (!navigator.geolocation) {
      setNearbyError("Tu navegador no ofrece geolocalización.");
      return;
    }
    setNearbyLoading(true);
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch("/api/discovery", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              query,
              filters,
              latitude: coords.latitude,
              longitude: coords.longitude,
            }),
          });
          const payload: unknown = await response.json();
          if (!response.ok || !payload || typeof payload !== "object") {
            throw new Error("No pudimos actualizar la búsqueda.");
          }
          const candidate = (payload as { rows?: unknown }).rows;
          setRows(
            Array.isArray(candidate) ? candidate.filter(isDiscoveryRow) : [],
          );
        } catch (error) {
          setNearbyError(
            error instanceof Error
              ? error.message
              : "No pudimos actualizar la búsqueda.",
          );
        } finally {
          setNearbyLoading(false);
        }
      },
      () => {
        setNearbyError(
          "No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.",
        );
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <section aria-live="polite" aria-label="Resultados de búsqueda">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink/60 text-sm">
          {rows.length === 0
            ? "No encontramos servicios con esos criterios."
            : rows.length + " resultado" + (rows.length === 1 ? "" : "s")}
        </p>
        <button
          className="button-secondary"
          type="button"
          onClick={searchNearby}
          disabled={nearbyLoading}
        >
          {nearbyLoading ? "Buscando cerca…" : "Buscar cerca mío"}
        </button>
      </div>
      {nearbyError ? (
        <p className="text-terracotta mt-3 text-sm">{nearbyError}</p>
      ) : null}
      {rows.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <DiscoveryCard
              key={row.provider_slug + "/" + row.service_slug}
              row={row}
            />
          ))}
        </div>
      ) : (
        <div className="border-ink/10 mt-5 rounded-2xl border border-dashed bg-white/45 p-8 text-center">
          <p className="font-display text-2xl font-semibold">
            Probá otra búsqueda
          </p>
          <p className="text-ink/60 mt-2 text-sm">
            También podés explorar una categoría o elegir servicios remotos.
          </p>
        </div>
      )}
    </section>
  );
}
