"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

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
  const [compressionNotice, setCompressionNotice] = useState<string | null>(
    null,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
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
      <section className="border-ink/10 bg-surface rounded-3xl border p-5 sm:p-6">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
          Documentos privados
        </p>
        <h2 className="font-display mt-2 text-2xl font-extrabold tracking-[-0.025em]">
          Carga temporalmente bloqueada
        </h2>
        <p className="text-ink/60 mt-2 text-sm leading-6">
          Tu perfil está en un estado que no admite cambios desde la cuenta. Los
          documentos ya recibidos siguen siendo privados.
        </p>
      </section>
    );
  }

  return (
    <section className="border-ink/10 bg-surface rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
            Privado
          </p>
          <h2 className="font-display mt-2 text-2xl font-extrabold tracking-[-0.025em]">
            Subí un documento
          </h2>
        </div>
        <span className="bg-moss/10 text-moss rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase">
          Máx. 10 MiB
        </span>
      </div>
      <p className="text-ink/60 mt-2 text-sm leading-6">
        JPG, PNG o PDF. El archivo se envía mediante el flujo privado existente
        y su ruta nunca se muestra en la interfaz pública.
      </p>

      <form
        action={formAction}
        encType="multipart/form-data"
        className="mt-6 space-y-5"
      >
        {directMetadata ? (
          <>
            <input
              type="hidden"
              name="storagePath"
              value={directMetadata.path}
            />
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
        <label className="block text-sm font-bold">
          Tipo de documento
          <select
            className="border-ink/15 bg-surface focus:border-moss focus:ring-moss/20 mt-2 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2"
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
          <div className="border-moss/20 bg-moss/5 overflow-hidden rounded-2xl border">
            {selected.previewUrl ? (
              <div className="bg-ink/5 aspect-[16/9] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.previewUrl}
                  alt="Vista previa del documento seleccionado"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="flex items-start gap-3 p-4">
              <span
                className="bg-moss/10 text-moss grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                aria-hidden="true"
              >
                {selected.file.type === "application/pdf" ? "PDF" : "IMG"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {selected.file.name}
                </p>
                <p className="text-ink/50 mt-1 text-xs">
                  {getDocumentTypeLabel(documentType)} ·{" "}
                  {formatFileSize(selected.file.size)}
                </p>
              </div>
              <button
                type="button"
                className="text-danger min-h-12 shrink-0 px-3 text-xs font-bold"
                onClick={clearSelection}
                disabled={pending || compressing}
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="border-ink/15 bg-canvas/55 rounded-2xl border border-dashed p-5 text-center">
            <div
              className="bg-moss/10 text-moss mx-auto grid h-12 w-12 place-items-center rounded-2xl"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <path
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold">Elegí cómo cargarlo</p>
            <p className="text-ink/50 mt-1 text-xs leading-5">
              Podés usar la cámara del teléfono o seleccionar un archivo
              guardado.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
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
          <p
            className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
            role="alert"
          >
            {localError}
          </p>
        ) : null}
        {compressionNotice ? (
          <p
            className="bg-moss/10 text-moss rounded-2xl px-4 py-3 text-sm"
            role="status"
          >
            {compressionNotice}
          </p>
        ) : null}
        {state.error ? (
          <p
            className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="bg-success/10 text-success rounded-2xl px-4 py-3 text-sm"
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
