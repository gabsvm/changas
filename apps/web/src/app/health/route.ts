import { getHealthPayload } from "@/lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getHealthPayload());
}
