"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
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
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

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
    setLocalError(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
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

    setLocalError(null);
    setSelected({
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    });
  }

  if (!editable) {
    return (
      <section className="border-ink/10 bg-surface rounded-3xl border p-5 sm:p-6">
        <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.14em] uppercase">
          Documentos privados
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold">
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
    <section className="border-ink/10 bg-surface rounded-3xl border p-5 shadow-[0_10px_30px_rgba(22,56,50,0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.14em] uppercase">
            Privado
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">
            Subí un documento
          </h2>
        </div>
        <span className="bg-moss/8 text-moss rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase">
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
        <label className="block text-sm font-semibold">
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
          disabled={pending}
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
                disabled={pending}
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="border-ink/15 bg-canvas/55 rounded-2xl border border-dashed p-5 text-center">
            <div
              className="bg-moss/8 text-moss mx-auto grid h-12 w-12 place-items-center rounded-2xl"
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
            disabled={pending}
          >
            Tomar foto
          </button>
          <button
            type="button"
            className="button-secondary w-full"
            onClick={() => openPicker("file")}
            disabled={pending}
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
          disabled={pending || !selected || Boolean(state.success)}
        >
          {pending ? "Subiendo…" : "Subir documento privado"}
        </button>
      </form>
    </section>
  );
}
