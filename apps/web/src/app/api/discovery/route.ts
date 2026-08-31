import { parseDiscoveryFilters } from "@changas/domain";
import { NextResponse } from "next/server";

import {
  isValidCoordinate,
  safeDiscoveryRows,
  searchDiscovery,
} from "@/lib/discovery/server";

type RequestBody = {
  query?: unknown;
  filters?: Record<string, unknown>;
  latitude?: unknown;
  longitude?: unknown;
};

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const filters = body.filters ?? {};
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (
    !isValidCoordinate(latitude, -90, 90) ||
    !isValidCoordinate(longitude, -180, 180)
  ) {
    return NextResponse.json(
      { error: "La ubicación no es válida." },
      { status: 400 },
    );
  }

  const { rows, error } = await searchDiscovery({
    query:
      typeof body.query === "string" ? body.query.trim().slice(0, 120) : "",
    filters: parseDiscoveryFilters({
      category: stringParam(filters.categorySlug),
      location: undefined,
      max: stringParam(filters.maxPrice),
      min: stringParam(filters.minPrice),
      mode: stringParam(filters.modality)?.toLowerCase(),
      offers: filters.acceptsOffers === true ? "true" : undefined,
      page: String(filters.page ?? "1"),
      pageSize: String(filters.pageSize ?? "24"),
      priceModel: stringParam(filters.priceModel),
      radius: String(filters.radiusMeters ?? "10000"),
      skill: stringParam(filters.skillSlug),
      sort: stringParam(filters.sort),
    }),
    latitude,
    longitude,
  });

  if (error) {
    return NextResponse.json(
      { error: "No pudimos buscar servicios." },
      { status: 500 },
    );
  }

  return NextResponse.json({ rows: safeDiscoveryRows(rows) });
}
