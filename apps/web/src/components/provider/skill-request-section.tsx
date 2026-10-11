import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { StatusChip } from "@/components/ui/marketplace/status-chip";

import {
  SkillRequestForm,
  type RequestCategory,
} from "./skill-request-form";

export type SkillRequestSummary = {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "MERGED" | "REJECTED";
  created_at: string;
};

const statusLabels: Record<SkillRequestSummary["status"], string> = {
  PENDING: "En revisión",
  APPROVED: "Aprobada",
  MERGED: "Unida a existente",
  REJECTED: "No aprobada",
};

const statusTones: Record<
  SkillRequestSummary["status"],
  "warning" | "success" | "info" | "danger"
> = {
  PENDING: "warning",
  APPROVED: "success",
  MERGED: "info",
  REJECTED: "danger",
};

export function SkillRequestSection({
  categories,
  requests,
}: {
  categories: RequestCategory[];
  requests: SkillRequestSummary[];
}) {
  return (
    <section aria-label="Proponer habilidad" className="mt-8 space-y-3">
      <SectionHeader
        title="¿Falta lo que hacés?"
        badge={{ tone: "violet", icon: "sliders", label: "Habilidad nueva" }}
      />
      {requests.length > 0 ? (
        <ol className="space-y-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="border-ink/[0.08] bg-surface flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">
                  {request.name}
                </strong>
                <span className="text-ink/60 text-xs">
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "medium",
                  }).format(new Date(request.created_at))}
                </span>
              </span>
              <StatusChip tone={statusTones[request.status]}>
                {statusLabels[request.status]}
              </StatusChip>
            </li>
          ))}
        </ol>
      ) : null}
      <SkillRequestForm categories={categories} />
    </section>
  );
}
