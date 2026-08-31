import { parseDiscoveryFiltersFromInternal } from "@changas/domain";
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

  const { rows, hasMore, error } = await searchDiscovery({
    query:
      typeof body.query === "string" ? body.query.trim().slice(0, 120) : "",
    filters: parseDiscoveryFiltersFromInternal(filters),
    latitude,
    longitude,
  });

  if (error) {
    return NextResponse.json(
      { error: "No pudimos buscar servicios." },
      { status: 500 },
    );
  }

  return NextResponse.json({ rows: safeDiscoveryRows(rows), hasMore });
}
