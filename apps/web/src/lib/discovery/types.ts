import type { DiscoveryServiceRow } from "@/lib/supabase/database.types";

export type ReputationDiscoveryServiceRow = DiscoveryServiceRow & {
  rating_average: number | null;
  adjusted_rating: number | null;
  review_count: number;
  completed_jobs: number;
  completion_rate: number | null;
  repeat_client_count: number;
};
