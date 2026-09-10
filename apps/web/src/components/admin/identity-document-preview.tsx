"use client";

import { useEffect, useState } from "react";

type IdentityDocument = {
  id: string;
  documentType: string;
  mimeType: string;
};

export function IdentityDocumentPreview({
  documents,
}: {
  documents: IdentityDocument[];
}) {
  const [selected, setSelected] = useState<IdentityDocument | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!selected) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  const documentUrl = selected
    ? `/api/admin/identity-documents/${encodeURIComponent(selected.id)}`
    : "";

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((document) => (
          <button
            className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#273142] bg-[#0d131d] px-4 py-3 text-left text-sm font-extrabold text-[#d0d5dd] transition-colors hover:border-[#4f7dff]/45 hover:text-white"
            key={document.id}
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setLoadError(false);
              setSelected(document);
            }}
          >
            <span>{document.documentType}</span>
            <span className="text-[#7ea2ff]" aria-hidden="true">
              Ver
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[#273142] bg-[#101720] p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-document-preview-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                className="text-base font-extrabold text-white"
                id="identity-document-preview-title"
              >
                {selected.documentType}
              </h2>
              <button
                className="min-h-11 rounded-xl px-3 text-sm font-bold text-[#d0d5dd] hover:bg-white/10"
                type="button"
                onClick={() => setSelected(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-[#0b1018]">
              {loadError ? (
                <p className="p-6 text-sm text-[#ffb4b0]" role="alert">
                  No pudimos abrir el documento. Verificá la configuración del
                  servidor.
                </p>
              ) : selected.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                  src={documentUrl}
                  alt={`Vista previa de ${selected.documentType}`}
                  onError={() => setLoadError(true)}
                />
              ) : selected.mimeType === "application/pdf" ? (
                <iframe
                  className="h-[70vh] w-full"
                  src={documentUrl}
                  title={`Vista previa de ${selected.documentType}`}
                  onError={() => setLoadError(true)}
                />
              ) : (
                <div className="p-6">
                  <p className="text-sm text-[#d0d5dd]">
                    Este formato no tiene vista previa integrada.
                  </p>
                  <a
                    className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#4f7dff] px-4 py-3 text-sm font-extrabold text-[#0b1018]"
                    href={documentUrl}
                  >
                    Abrir documento
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
