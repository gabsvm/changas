import { StatusChip } from "@/components/ui/marketplace/status-chip";
import {
  createOwnerIdentityDocumentSignedUrl,
  OwnerDocumentError,
} from "@/lib/provider/documents";
import { formatFileSize, getDocumentTypeLabel } from "@/lib/ui/documents";

export async function DocumentListItem({
  documentId,
  documentType,
  createdAt,
  mimeType,
  fileSizeBytes,
}: {
  documentId: string;
  documentType: string;
  createdAt: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
}) {
  let previewUrl: string | null = null;
  try {
    const signed = await createOwnerIdentityDocumentSignedUrl(documentId);
    previewUrl = signed.mimeType.startsWith("image/") ? signed.url : null;
  } catch (error) {
    if (!(error instanceof OwnerDocumentError)) throw error;
    previewUrl = null;
  }

  const isPdf = (mimeType ?? "").endsWith("pdf");

  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Vista previa de ${getDocumentTypeLabel(documentType)}`}
          className="border-ink/[0.08] h-14 w-14 shrink-0 rounded-xl border object-cover"
          loading="lazy"
        />
      ) : (
        <span
          className="bg-success/10 text-success grid h-14 w-14 shrink-0 place-items-center rounded-xl text-xs font-extrabold"
          aria-hidden="true"
        >
          {isPdf ? "PDF" : "✓"}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {getDocumentTypeLabel(documentType)}
        </span>
        <span className="text-ink/45 mt-0.5 block text-xs">
          Recibido {new Date(createdAt).toLocaleDateString("es-AR")}
          {typeof fileSizeBytes === "number"
            ? ` · ${formatFileSize(fileSizeBytes)}`
            : null}
        </span>
      </span>
      <StatusChip tone="success">Cargado</StatusChip>
    </li>
  );
}
