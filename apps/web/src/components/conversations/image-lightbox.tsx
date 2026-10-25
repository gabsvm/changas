"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "@/lib/ui/use-dialog-focus";

export type PreviewImage = { id: string; name: string };

export function ImageLightbox({
  image,
  onClose,
}: {
  image: PreviewImage | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useDialogFocus(Boolean(image), dialogRef, closeRef, onClose);

  useEffect(() => {
    if (!image) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [image]);

  if (!image) return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar vista de imagen"
        className="absolute inset-0 bg-[#030912]/90 backdrop-blur-md"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#12D9C5]/25 bg-[#0d1827] p-3 text-white shadow-[0_30px_100px_rgb(0_0_0/65%)] sm:p-5"
      >
        <div className="mb-3 flex min-h-12 items-center justify-between gap-3">
          <h2
            id={titleId}
            className="min-w-0 truncate text-sm font-bold sm:text-base"
          >
            {image.name}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar imagen"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65EC91]"
          >
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
          {/* unoptimized: adjunto privado; /messages/attachments exige sesión y
              redirige a una URL firmada. El optimizador no debe cachearlo para
              otros usuarios. */}
          <Image
            unoptimized
            src={`/messages/attachments/${image.id}`}
            alt={image.name}
            width={1200}
            height={900}
            className="max-h-[77dvh] w-auto max-w-full object-contain"
          />
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ConversationAttachmentCard({
  attachment,
  own,
  sizeLabel,
}: {
  attachment: {
    id: string;
    originalName: string;
    mimeType: string;
  };
  own: boolean;
  sizeLabel: string;
}) {
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const isImage = attachment.mimeType.startsWith("image/");
  const className = own
    ? "block w-full overflow-hidden rounded-xl border border-white/20 bg-white/10 text-left"
    : "block w-full overflow-hidden rounded-xl border border-ink/10 bg-canvas text-left";
  const content = (
    <>
      {isImage ? (
        // unoptimized: adjunto privado (ver lightbox).
        <Image
          unoptimized
          width={480}
          height={320}
          src={"/messages/attachments/" + attachment.id}
          alt={attachment.originalName}
          className="h-40 w-full object-cover"
        />
      ) : null}
      <span className="block px-3 py-2">
        <span className="block truncate font-semibold">
          {isImage ? "Imagen" : "Archivo"} · {attachment.originalName}
        </span>
        <span
          className={
            own ? "text-[11px] text-white/65" : "text-ink/70 text-[11px]"
          }
        >
          {sizeLabel}
        </span>
      </span>
    </>
  );

  return (
    <>
      {isImage ? (
        <button
          type="button"
          className={className}
          onClick={() => setPreviewOpen(true)}
          aria-label={"Ampliar imagen: " + attachment.originalName}
        >
          {content}
        </button>
      ) : (
        <a
          href={"/messages/attachments/" + attachment.id}
          className={className}
          target="_blank"
          rel="noreferrer"
        >
          {content}
        </a>
      )}
      {isImage ? (
        <ImageLightbox
          image={
            isPreviewOpen
              ? { id: attachment.id, name: attachment.originalName }
              : null
          }
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
