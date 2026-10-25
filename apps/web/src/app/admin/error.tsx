"use client";

import { SegmentError } from "@/components/ui/segment-error";
import type { ClientError } from "@/lib/observability";

export default function Error(
  props: Readonly<{ error: ClientError; reset: () => void }>,
) {
  return <SegmentError {...props} />;
}
