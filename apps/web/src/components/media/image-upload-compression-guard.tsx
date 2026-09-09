"use client";

import { useEffect, useRef, useState } from "react";

import {
  compressImageForUpload,
  isCompressibleImageType,
} from "@/lib/media/image-compression";

type GuardStatus =
  | { kind: "working"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

function formatKiB(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

export function ImageUploadCompressionGuard() {
  const [status, setStatus] = useState<GuardStatus>(null);
  const bypassNextChange = useRef(new WeakSet<HTMLInputElement>());
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    function scheduleDismiss() {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => setStatus(null), 2200);
    }

    async function handleChange(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;

      if (bypassNextChange.current.has(input)) {
        bypassNextChange.current.delete(input);
        return;
      }

      const files = Array.from(input.files ?? []);
      if (!files.some((file) => isCompressibleImageType(file.type))) return;

      if (typeof DataTransfer !== "function") {
        setStatus({
          kind: "error",
          message: "Este navegador no permite optimizar la imagen antes de subirla.",
        });
        input.value = "";
        scheduleDismiss();
        return;
      }

      input.dataset.imageCompressing = "true";
      setStatus({
        kind: "working",
        message: files.length > 1 ? "Optimizando imágenes…" : "Optimizando imagen…",
      });

      try {
        const processed = [] as File[];
        let originalImageBytes = 0;
        let finalImageBytes = 0;

        for (const file of files) {
          if (!isCompressibleImageType(file.type)) {
            processed.push(file);
            continue;
          }

          originalImageBytes += file.size;
          const result = await compressImageForUpload(file);
          processed.push(result.file);
          finalImageBytes += result.compressedBytes;
        }

        const transfer = new DataTransfer();
        for (const file of processed) transfer.items.add(file);
        input.files = transfer.files;

        bypassNextChange.current.add(input);
        input.dispatchEvent(new Event("change", { bubbles: true }));

        setStatus({
          kind: "success",
          message:
            originalImageBytes > finalImageBytes
              ? `Imagen optimizada: ${formatKiB(finalImageBytes)} para subir.`
              : `Imagen lista: ${formatKiB(finalImageBytes)}.`,
        });
        scheduleDismiss();
      } catch (error) {
        input.value = "";
        bypassNextChange.current.add(input);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        setStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos optimizar la imagen. Elegí otra e intentá nuevamente.",
        });
        scheduleDismiss();
      } finally {
        delete input.dataset.imageCompressing;
      }
    }

    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.querySelector('input[type="file"][data-image-compressing="true"]')) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus({
        kind: "working",
        message: "Terminando de optimizar la imagen antes de subirla…",
      });
    }

    document.addEventListener("change", handleChange, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("submit", handleSubmit, true);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!status) return null;

  return (
    <div
      className={`fixed right-4 bottom-20 left-4 z-[100] mx-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl sm:right-6 sm:bottom-6 sm:left-auto ${
        status.kind === "error"
          ? "border-danger/25 bg-[#fff4f2] text-danger"
          : "border-ink/10 bg-[#202124] text-white"
      }`}
      role={status.kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.message}
    </div>
  );
}
