import type { ReputationDiscoveryServiceRow } from "@/lib/discovery/types";
import { ServiceCard } from "@/components/ui/marketplace/service-card";

export function DiscoveryCard({ row }: { row: ReputationDiscoveryServiceRow }) {
  return <ServiceCard row={row} />;
}
