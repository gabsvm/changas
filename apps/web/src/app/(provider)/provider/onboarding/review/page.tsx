import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentListItem } from "@/components/provider/document-list-item";
import { maskPrivateReference } from "@/lib/ui/documents";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { hasRequiredIdentityDocuments } from "@/lib/ui/provider-submission";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

export const dynamic = "force-dynamic";

function CompletionRow({
  label,
  complete,
  href,
  editable,
}: {
  label: string;
  complete: boolean;
  href: string;
  editable: boolean;
}) {
  const content = (
    <>
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-1.5">
        <StatusChip tone={complete ? "success" : "warning"}>
          {complete ? "Completo" : "Revisar"}
        </StatusChip>
        {editable ? (
          <span className="text-ink/25 text-xl" aria-hidden="true">
            ›
          </span>
        ) : null}
      </span>
    </>
  );

  if (!editable) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-14 items-center justify-between gap-4 py-3"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="consumer-pressable hover:bg-ink/[0.035] flex min-h-14 items-center justify-between gap-4 rounded-lg px-1 py-3"
    >
      {content}
    </Link>
  );
}

export default async function ProviderOnboardingReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding/review");
  }

  const [
    { data: provider },
    { data: profile },
    { data: privateProfile },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select(
        "legal_name, private_phone, date_of_birth, exact_address, dni_number",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("provider_documents")
      .select("id, document_type, mime_type, file_size_bytes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!provider) {
    redirect("/provider/onboarding");
  }

  const presentation = getProviderStatusPresentation(provider.status);
  const publicComplete = Boolean(
    profile?.display_name && profile?.public_zone && profile?.bio,
  );
  const privateComplete = Boolean(
    privateProfile?.legal_name &&
    privateProfile?.private_phone &&
    privateProfile?.date_of_birth &&
    privateProfile?.exact_address &&
    privateProfile?.dni_number,
  );
  const receivedDocuments = documents ?? [];
  const documentsComplete = hasRequiredIdentityDocuments(receivedDocuments);
  const readyForSubmission =
    publicComplete && privateComplete && documentsComplete;
  const pendingReview =
    provider.status === "IDENTITY_PENDING" ||
    provider.status === "UNDER_REVIEW";
  const approved = provider.status === "ACTIVE";
  const rejected = provider.status === "REJECTED";
  const editable =
    canSelfManageProviderStatus(provider.status) && !pendingReview;

  let summary =
    "Este resumen no envía tu identidad. La revisión empieza únicamente cuando confirmás el envío desde Documentos.";
  if (pendingReview) {
    summary =
      "Tu identidad ya está en la cola administrativa. La evidencia queda bloqueada mientras se toma una decisión.";
  } else if (approved) {
    summary =
      "Tu identidad fue aprobada y el perfil de proveedor está habilitado.";
  } else if (rejected) {
    summary =
      "La revisión requiere intervención antes de que el perfil pueda habilitarse.";
  } else if (readyForSubmission) {
    summary =
      "Los requisitos están completos. Falta enviarlos desde Documentos para entrar en revisión.";
  }

  const stateTone = pendingReview
    ? "info"
    : approved
      ? "success"
      : rejected
        ? "danger"
        : "warning";
  const stateTitle = pendingReview
    ? "Caso enviado"
    : approved
      ? "Prestador habilitado"
      : rejected
        ? "Revisión requiere atención"
        : readyForSubmission
          ? "Falta enviarlo a revisión"
          : "Verificación incompleta";

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Revisión" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
              Paso 4 de 4
            </p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
              Estado de tu verificación
            </h1>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/58 mt-2 text-sm leading-6">{summary}</p>

        <div className="consumer-card bg-surface mt-5 flex items-center gap-3 p-4">
          <Avatar
            name={profile?.display_name ?? "Tu perfil"}
            src={null}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">
              {profile?.display_name ?? "Sin nombre"}
            </p>
            <p className="text-ink/60 mt-0.5 truncate text-[13px]">
              {profile?.public_zone ?? "Sin zona"}
              {profile?.bio ? ` · ${profile.bio}` : null}
            </p>
          </div>
        </div>

        <section className="border-ink/10 divide-ink/10 mt-5 divide-y border-y">
          <CompletionRow
            label="Perfil público"
            complete={publicComplete}
            href="/provider/onboarding/profile"
            editable={editable}
          />
          <CompletionRow
            label="Identidad privada"
            complete={privateComplete}
            href="/provider/onboarding/identity"
            editable={editable}
          />
          <CompletionRow
            label="Documentos requeridos"
            complete={documentsComplete}
            href="/provider/onboarding/documents"
            editable={editable}
          />
        </section>

        <section className="mt-6" aria-label="Lo que cargaste">
          <h2 className="text-lg leading-7 font-bold">Lo que cargaste</h2>
          <details className="border-ink/10 mt-3 border-y">
            <summary className="consumer-pressable flex min-h-14 cursor-pointer items-center justify-between gap-3 py-3 text-sm font-bold">
              Perfil público
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <dl className="space-y-2.5 pb-4 text-sm">
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  Nombre visible
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {profile?.display_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  Zona
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {profile?.public_zone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  Presentación
                </dt>
                <dd className="mt-0.5 leading-6">{profile?.bio ?? "—"}</dd>
              </div>
            </dl>
            {editable ? (
              <Link
                className="text-moss mb-4 inline-flex min-h-11 items-center text-sm font-bold"
                href="/provider/onboarding/profile"
              >
                Editar paso 1
              </Link>
            ) : null}
          </details>
          <details className="border-ink/10 border-b">
            <summary className="consumer-pressable flex min-h-14 cursor-pointer items-center justify-between gap-3 py-3 text-sm font-bold">
              Identidad privada
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <dl className="space-y-2.5 pb-4 text-sm">
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  Nombre legal
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {privateProfile?.legal_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  DNI
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {maskPrivateReference(privateProfile?.dni_number ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-ink/48 text-xs font-bold tracking-[0.06em] uppercase">
                  Teléfono
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {maskPrivateReference(privateProfile?.private_phone ?? null)}
                </dd>
              </div>
            </dl>
            {editable ? (
              <Link
                className="text-moss mb-4 inline-flex min-h-11 items-center text-sm font-bold"
                href="/provider/onboarding/identity"
              >
                Editar paso 2
              </Link>
            ) : null}
          </details>
        </section>

        <div className="border-ink/10 mt-5 rounded-xl border px-4 py-3">
          <StatusChip tone={stateTone}>{stateTitle}</StatusChip>
          <p className="text-ink/58 mt-2 text-sm leading-6">
            {pendingReview
              ? "Un administrador puede revisar ahora la evidencia privada y decidir el estado del perfil."
              : approved
                ? "No necesitás volver a enviar documentación desde este flujo."
                : rejected
                  ? "La documentación se conserva y queda sujeta a una nueva decisión administrativa."
                  : readyForSubmission
                    ? "Volvé a Documentos y tocá “Enviar a revisión”."
                    : "Completá los elementos marcados como Revisar antes de enviar."}
          </p>
          {!pendingReview && !approved && !rejected ? (
            <Link
              className="button-primary mt-3 w-full sm:w-auto"
              href="/provider/onboarding/documents"
            >
              Ir a documentos
            </Link>
          ) : null}
        </div>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Archivos recibidos</h2>
            <span className="text-ink/45 text-xs font-semibold">
              {receivedDocuments.length}
            </span>
          </div>

          {receivedDocuments.length > 0 ? (
            <ul className="border-ink/10 divide-ink/10 mt-2 divide-y border-y">
              {receivedDocuments.map((document) => (
                <DocumentListItem
                  key={`${document.document_type}-${document.created_at}`}
                  documentType={document.document_type}
                  createdAt={document.created_at}
                  documentId={document.id}
                  mimeType={document.mime_type}
                  fileSizeBytes={document.file_size_bytes}
                />
              ))}
            </ul>
          ) : (
            <p className="text-ink/50 border-ink/10 mt-2 border-y py-4 text-sm">
              Todavía no hay documentos registrados.
            </p>
          )}
        </section>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            className="button-primary w-full sm:w-auto"
            href="/provider/onboarding"
          >
            Volver al resumen
          </Link>
          <Link className="button-secondary w-full sm:w-auto" href="/account">
            Ir a mi cuenta
          </Link>
        </div>
      </div>
    </section>
  );
}
