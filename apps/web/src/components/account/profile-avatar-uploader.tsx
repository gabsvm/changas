"use client";

import { useEffect, useRef, useState } from "react";

import { saveProfileAvatarUpload } from "@/app/(account)/actions";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { compressImageForUpload } from "@/lib/media/image-compression";
import { createClient } from "@/lib/supabase/client";

export function ProfileAvatarUploader({
  displayName,
  initialAvatarUrl,
}: {
  displayName: string;
  initialAvatarUrl?: string | null | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const source = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!source) return;

    setPending(true);
    setError(null);
    setMessage("Optimizando imagen…");
    let uploadedPath: string | null = null;

    try {
      const compressed = await compressImageForUpload(source);
      const file = compressed.file;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      uploadedPath = path;
      setMessage(
        `Subiendo foto optimizada · ${Math.max(1, Math.round(file.size / 1024))} KiB`,
      );

      const upload = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upload.error) {
        throw new Error(upload.error.message || "No pudimos subir la foto.");
      }

      const result = await saveProfileAvatarUpload({
        path,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!result.ok) {
        await supabase.storage.from("profile-avatars").remove([path]);
        uploadedPath = null;
        throw new Error(result.error);
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(file);
      setAvatarUrl(objectUrlRef.current);
      setMessage("Foto actualizada");
    } catch (caught) {
      if (uploadedPath) {
        try {
          const supabase = createClient();
          await supabase.storage.from("profile-avatars").remove([uploadedPath]);
        } catch {
          // Best-effort cleanup. Server registration remains authoritative.
        }
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos actualizar la foto.",
      );
      setMessage(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={displayName} src={avatarUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleChange}
          aria-label="Elegir foto de perfil"
        />
        <button
          type="button"
          className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.07] inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          {pending
            ? "Procesando…"
            : avatarUrl
              ? "Cambiar foto"
              : "Agregar foto"}
        </button>
        <p className="text-ink/45 mt-0.5 text-xs leading-5">
          Se optimiza automáticamente antes de subirla.
        </p>
        {message ? (
          <p
            className="text-success mt-1 text-xs"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-danger mt-1 text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
