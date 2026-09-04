import { getHealthPayload } from "@/lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getHealthPayload(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
