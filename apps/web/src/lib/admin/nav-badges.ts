"use server";

import { listAdminIdentityQueue } from "@/lib/admin/identity";
import { listAdminReports } from "@/lib/admin/server";
import type { AdminNavBadgeCounts } from "@/lib/ui/admin-navigation";

// Conteos para los badges de la navegación admin. Reutiliza las mismas
// queries del resumen (/admin) sin duplicar lógica; alcance acotado a
// identidad+reportes, que son las colas que exigen decisión.
export async function getAdminNavBadgeCounts(): Promise<AdminNavBadgeCounts> {
  const [identityQueue, openReports] = await Promise.all([
    listAdminIdentityQueue(),
    listAdminReports("OPEN"),
  ]);
  return {
    identityPending: identityQueue.length,
    openReports: openReports.length,
  };
}
