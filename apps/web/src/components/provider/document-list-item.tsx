import { getDocumentTypeLabel } from "@/lib/ui/documents";

export function DocumentListItem({
  documentType,
  createdAt,
}: {
  documentType: string;
  createdAt: string;
}) {
  return (
    <li className="border-ink/10 bg-surface flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3">
      <span
        className="bg-moss/8 text-moss grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">
          {getDocumentTypeLabel(documentType)}
        </span>
        <span className="text-ink/50 mt-1 block text-xs">
          Recibido {new Date(createdAt).toLocaleDateString("es-AR")}
        </span>
      </span>
      <span className="bg-success/10 text-success rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.06em] uppercase">
        Cargado
      </span>
    </li>
  );
}
