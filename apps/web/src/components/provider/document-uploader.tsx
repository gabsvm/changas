"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { StatusChip } from "@/components/ui/marketplace/status-chip";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import { compressInputFiles } from "@/lib/media/image-compression";
import { createClient } from "@/lib/supabase/client";
import {
  formatFileSize,
  getDocumentTypeLabel,
  validateIdentityFileMetadata,
} from "@/lib/ui/documents";

type ProviderAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type SelectedFile = {
  file: File;
  previewUrl: string | null;
};

export function DocumentUploader({
  action,
  editable,
}: {
  action: ProviderAction;
  editable: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState("DNI_FRONT");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [directMetadata, setDirectMetadata] = useState<{
    path: string;
    mimeType: string;
    size: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected]);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  function openPicker(mode: "camera" | "file") {
    const input = inputRef.current;
    if (!input || !editable || pending) return;

    if (mode === "camera") {
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
    } else {
      input.accept = "image/jpeg,image/png,application/pdf";
      input.removeAttribute("capture");
    }

    input.click();
  }

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    setSelected(null);
    setDirectMetadata(null);
    setLocalError(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (!input.files?.[0]) {
      setSelected(null);
      setDirectMetadata(null);
      return;
    }

    setCompressing(true);
    setLocalError(null);
    setCompressionNotice(null);
    setDirectMetadata(null);
    try {
      const result = await compressInputFiles(input);
      if (result.originalBytes > result.compressedBytes) {
        setCompressionNotice(
          `Imagen optimizada: ${Math.max(1, Math.round(result.compressedBytes / 1024))} KiB para subir.`,
        );
      }
    } catch (error) {
      input.value = "";
      setSelected(null);
      setDirectMetadata(null);
      setLocalError(
        error instanceof Error
          ? error.message
          : "No pudimos optimizar la imagen.",
      );
      return;
    } finally {
      setCompressing(false);
    }

    const file = input.files?.[0];
    if (!file) {
      setSelected(null);
      return;
    }

    const validation = validateIdentityFileMetadata({
      type: file.type,
      size: file.size,
    });

    if (!validation.valid) {
      event.currentTarget.value = "";
      setSelected(null);
      setLocalError(validation.reason);
      return;
    }

    setSelected({
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    });

    if (file.type.startsWith("image/")) return;

    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      input.value = "";
      setSelected(null);
      setLocalError("Tu sesión expiró. Volvé a iniciar sesión.");
      setUploading(false);
      return;
    }
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "document";
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage
      .from("identity-documents")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      input.value = "";
      setSelected(null);
      setLocalError("No pudimos subir el documento.");
      setUploading(false);
      return;
    }
    input.value = "";
    setDirectMetadata({
      path: storagePath,
      mimeType: file.type,
      size: file.size,
    });
    setUploading(false);
  }

  if (!editable) {
    return (
      <section className="border-ink/10 border-y py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Documentos privados</h2>
          <StatusChip tone="warning">Carga bloqueada</StatusChip>
        </div>
        <p className="text-ink/55 mt-1 text-sm leading-6">
          Tu perfil está en un estado que no admite cambios. Los documentos ya
          recibidos siguen siendo privados.
        </p>
      </section>
    );
  }

  return (
    <section className="border-ink/10 border-y py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
            Privado
          </p>
          <h2 className="mt-1 text-lg font-bold">Subí un documento</h2>
        </div>
        <StatusChip tone="neutral">Máx. 10 MiB</StatusChip>
      </div>
      <p className="text-ink/55 mt-1 text-sm leading-6">
        JPG, PNG o PDF. La ruta privada del archivo nunca se muestra públicamente.
      </p>

      <form
        action={formAction}
        encType="multipart/form-data"
        className="mt-4 space-y-4"
      >
        {directMetadata ? (
          <>
            <input type="hidden" name="storagePath" value={directMetadata.path} />
            <input
              type="hidden"
              name="storageMimeType"
              value={directMetadata.mimeType}
            />
            <input
              type="hidden"
              name="storageFileSizeBytes"
              value={directMetadata.size}
            />
          </>
        ) : null}

        <label className="block text-sm font-semibold">
          Tipo de documento
          <select
            className="border-ink/15 bg-surface focus:border-moss focus:ring-moss/20 mt-1.5 min-h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
            name="documentType"
            value={documentType}
            onChange={(event) => setDocumentType(event.currentTarget.value)}
            disabled={pending}
          >
            <option value="DNI_FRONT">DNI frente</option>
            <option value="DNI_BACK">DNI dorso</option>
            <option value="SELFIE">Selfie de validación</option>
          </select>
        </label>

        <input
          ref={inputRef}
          className="sr-only"
          name="document"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileChange}
          disabled={pending || compressing || uploading}
          tabIndex={-1}
        />

        {selected ? (
          <div className="border-ink/10 overflow-hidden rounded-xl border">
            {selected.previewUrl ? (
              <div className="bg-ink/[0.04] aspect-[16/9] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.previewUrl}
                  alt="Vista previa del documento seleccionado"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">
              <span
                className="bg-moss/8 text-moss grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.68rem] font-bold"
                aria-hidden="true"
              >
                {selected.file.type === "application/pdf" ? "PDF" : "IMG"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selected.file.name}</p>
                <p className="text-ink/45 mt-0.5 text-xs">
                  {getDocumentTypeLabel(documentType)} · {formatFileSize(selected.file.size)}
                </p>
              </div>
              <button
                type="button"
                className="consumer-pressable text-danger min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold"
                onClick={clearSelection}
                disabled={pending || compressing}
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="border-ink/15 text-ink/52 rounded-xl border border-dashed px-4 py-5 text-center text-sm">
            Tomá una foto o elegí un archivo guardado.
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="button-secondary w-full"
            onClick={() => openPicker("camera")}
            disabled={pending || compressing || uploading}
          >
            Tomar foto
          </button>
          <button
            type="button"
            className="button-secondary w-full"
            onClick={() => openPicker("file")}
            disabled={pending || compressing || uploading}
          >
            Elegir archivo
          </button>
        </div>

        {localError ? (
          <p className="bg-danger/[0.07] text-danger rounded-xl px-3 py-2.5 text-sm" role="alert">
            {localError}
          </p>
        ) : null}
        {compressionNotice ? (
          <p className="bg-moss/[0.07] text-moss rounded-xl px-3 py-2.5 text-sm" role="status">
            {compressionNotice}
          </p>
        ) : null}
        {state.error ? (
          <p className="bg-danger/[0.07] text-danger rounded-xl px-3 py-2.5 text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="bg-success/[0.07] text-success rounded-xl px-3 py-2.5 text-sm"
            role="status"
            aria-live="polite"
          >
            {state.success}
          </p>
        ) : null}

        <button
          className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          type="submit"
          disabled={pending || compressing || uploading || !selected}
        >
          {compressing
            ? "Optimizando…"
            : uploading
              ? "Preparando…"
              : pending
                ? "Registrando…"
                : "Subir documento privado"}
        </button>
      </form>
    </section>
  );
}
