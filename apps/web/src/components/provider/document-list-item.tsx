import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { getDocumentTypeLabel } from "@/lib/ui/documents";

export function DocumentListItem({
  documentType,
  createdAt,
}: {
  documentType: string;
  createdAt: string;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      <span
        className="bg-success/10 text-success grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold"
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {getDocumentTypeLabel(documentType)}
        </span>
        <span className="text-ink/45 mt-0.5 block text-xs">
          Recibido {new Date(createdAt).toLocaleDateString("es-AR")}
        </span>
      </span>
      <StatusChip tone="success">Cargado</StatusChip>
    </li>
  );
}
