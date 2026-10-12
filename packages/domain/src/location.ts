export type ManualLocation = {
  slug: string;
  label: string;
  latitude: number;
  longitude: number;
};

// These are coarse locality centroids for URL-safe manual selection, not provider coordinates.
// AMBA entries keep their existing slugs/coordinates; Córdoba entries below
// use approximate city centroids (documented as such), good enough for
// discovery sorting but not for navigation or provider positioning.
export const manualLocations: readonly ManualLocation[] = [
  {
    slug: "palermo",
    label: "Palermo",
    latitude: -34.5838,
    longitude: -58.4258,
  },
  {
    slug: "belgrano",
    label: "Belgrano",
    latitude: -34.5627,
    longitude: -58.4567,
  },
  {
    slug: "caballito",
    label: "Caballito",
    latitude: -34.6186,
    longitude: -58.4416,
  },
  {
    slug: "san-telmo",
    label: "San Telmo",
    latitude: -34.6214,
    longitude: -58.3731,
  },
  {
    slug: "vicente-lopez",
    label: "Vicente López",
    latitude: -34.5266,
    longitude: -58.4747,
  },
  {
    slug: "cordoba-capital",
    label: "Córdoba Capital",
    // Approximate centroid of Córdoba city, Córdoba province.
    latitude: -31.4201,
    longitude: -64.1888,
  },
  {
    slug: "villa-carlos-paz",
    label: "Villa Carlos Paz",
    // Approximate centroid of Villa Carlos Paz, Córdoba province.
    latitude: -31.4241,
    longitude: -64.4978,
  },
  {
    slug: "rio-cuarto",
    label: "Río Cuarto",
    // Approximate centroid of Río Cuarto city, Córdoba province.
    latitude: -33.1232,
    longitude: -64.3493,
  },
];

export function getManualLocation(
  slug: string | null | undefined,
): ManualLocation | null {
  return manualLocations.find((location) => location.slug === slug) ?? null;
}
