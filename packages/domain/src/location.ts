export type ManualLocation = {
  slug: string;
  label: string;
  latitude: number;
  longitude: number;
};

// These are coarse locality centroids for URL-safe manual selection, not provider coordinates.
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
];

export function getManualLocation(
  slug: string | null | undefined,
): ManualLocation | null {
  return manualLocations.find((location) => location.slug === slug) ?? null;
}
