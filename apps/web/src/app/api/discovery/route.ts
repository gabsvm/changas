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
  const latitude = isValidCoordinate(body.latitude, -90, 90)
    ? body.latitude
    : null;
  const longitude = isValidCoordinate(body.longitude, -180, 180)
    ? body.longitude
    : null;

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
