"use client";

import Link from "next/link";
import { useState } from "react";

import { manualLocations } from "@changas/domain";

export const browserLocationStorageKey = "changas:search-location";

type BrowserLocation = { latitude: number; longitude: number };

function findNearestManualLocation(
  latitude: number,
  longitude: number,
): (typeof manualLocations)[number] | null {
  let nearest: (typeof manualLocations)[number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const location of manualLocations) {
    const latitudeDistance = (latitude - location.latitude) * 111;
    const longitudeDistance =
      (longitude - location.longitude) *
      111 *
      Math.cos((latitude * Math.PI) / 180);
    const distance = Math.hypot(latitudeDistance, longitudeDistance);
    if (distance < nearestDistance) {
      nearest = location;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= 35 ? nearest : null;
}

export function LocationPicker({
  selected,
  compact = false,
}: {
  selected?: string | null;
  compact?: boolean;
}) {
  const [manualLocation, setManualLocation] = useState(selected ?? "");
  const [usingDeviceLocation, setUsingDeviceLocation] = useState(false);
  const [deviceLocationLabel, setDeviceLocationLabel] = useState<string | null>(
    null,
  );
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  function clearDeviceLocation() {
    window.sessionStorage.removeItem(browserLocationStorageKey);
    setUsingDeviceLocation(false);
  }

  function selectManualLocation(value: string) {
    setManualLocation(value);
    clearDeviceLocation();
    setDeviceLocationLabel(null);
    setLocationMessage(null);
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Tu navegador no ofrece ubicación automática.");
      return;
    }

    setLocationMessage("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location: BrowserLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        window.sessionStorage.setItem(
          browserLocationStorageKey,
          JSON.stringify(location),
        );
        const nearest = findNearestManualLocation(
          location.latitude,
          location.longitude,
        );
        setUsingDeviceLocation(true);
        setDeviceLocationLabel(nearest?.label ?? "Ubicación actual");
        setManualLocation("");
        setLocationMessage(
          nearest
            ? `${nearest.label} · ubicación actual`
            : "Ubicación actual detectada",
        );
      },
      () => {
        setLocationMessage(
          "No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  if (compact) {
    return (
      <div className="location-picker-compact flex flex-wrap items-center gap-2">
        <label className="text-ink/58 flex min-h-11 items-center gap-2 text-sm font-semibold">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4.5 w-4.5"
            fill="none"
          >
            <path
              d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <circle
              cx="12"
              cy="10"
              r="2"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
          <span className="sr-only">Zona</span>
          <select
            className="focus:border-moss/35 text-ink min-h-11 max-w-[12rem] rounded-lg border border-transparent bg-transparent px-1.5 text-sm font-semibold outline-none focus:bg-white"
            value={manualLocation}
            id="location"
            name="location"
            onChange={(event) =>
              selectManualLocation(event.currentTarget.value)
            }
          >
            <option value="">
              {usingDeviceLocation
                ? `${deviceLocationLabel ?? "Ubicación actual"} · actual`
                : "Sin ubicación"}
            </option>
            {manualLocations.map((location) => (
              <option key={location.slug} value={location.slug}>
                {location.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="location-picker-trigger consumer-pressable text-ink inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/75 px-3 text-xs font-bold shadow-[0_4px_12px_rgba(32,33,36,0.08)] hover:bg-white"
          type="button"
          onClick={useDeviceLocation}
        >
          <span aria-hidden="true">⌖</span>
          {usingDeviceLocation
            ? (deviceLocationLabel ?? "Ubicación actual")
            : "Usar mi ubicación"}
        </button>
        {locationMessage ? (
          <span
            className="text-ink/60 basis-full text-xs font-semibold"
            role="status"
          >
            {locationMessage}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="location-picker space-y-3">
      <label className="text-ink/65 text-sm font-semibold" htmlFor="location">
        ¿Dónde lo necesitás?
      </label>
      <select
        className="consumer-control focus:border-moss/45 focus:ring-moss/10 w-full px-3 text-sm outline-none focus:ring-2"
        value={manualLocation}
        id="location"
        name="location"
        onChange={(event) => selectManualLocation(event.currentTarget.value)}
      >
        <option value="">Sin ubicación</option>
        {manualLocations.map((location) => (
          <option key={location.slug} value={location.slug}>
            {location.label}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className="location-picker-trigger consumer-pressable border-ink/10 hover:border-moss/30 inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold shadow-[0_4px_14px_rgba(32,33,36,0.06)]"
          type="button"
          onClick={useDeviceLocation}
        >
          <span aria-hidden="true">⌖</span>
          {usingDeviceLocation
            ? (deviceLocationLabel ?? "Ubicación actual")
            : "Usar mi ubicación"}
        </button>
        <Link
          className="text-terracotta font-semibold"
          href="/buscar?mode=remoto"
        >
          Buscar remoto →
        </Link>
      </div>
      {locationMessage ? (
        <p className="text-ink/55 text-xs" role="status">
          {locationMessage}
        </p>
      ) : (
        <p className="text-ink/50 text-xs">
          Es opcional. Podés usar tu ubicación del dispositivo o elegir una
          zona.
        </p>
      )}
    </div>
  );
}
