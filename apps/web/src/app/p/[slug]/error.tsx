"use client";

import { SegmentError } from "@/components/ui/segment-error";
import type { ClientError } from "@/lib/observability";

export default function Error(
  props: Readonly<{ error: ClientError; reset: () => void }>,
) {
  return (
    <main
      id="main-content"
      className="bg-canvas text-ink mobile-content-with-nav min-h-screen px-4 sm:px-8"
    >
      <SegmentError {...props} />
    </main>
  );
}
