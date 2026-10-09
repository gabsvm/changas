import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentListItem } from "@/components/provider/document-list-item";
import { maskPrivateReference } from "@/lib/ui/documents";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
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
  const { data: latestReview } = rejected
    ? await (
        supabase as unknown as {
          rpc(name: string): Promise<{
            data: Array<{ reason: string | null }> | null;
            error: unknown;
          }>;
        }
      ).rpc("get_my_latest_identity_review")
    : { data: null };
  const rejectionReason = latestReview?.[0]?.reason ?? null;
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
      "Tu identidad fue rechazada. Revisá el motivo, corregí lo observado y reenviala a revisión.";
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
          <div className="flex min-w-0 items-center gap-3">
            <IllustratedBadge tone="gold" icon="check" size="md" label="Paso 4 de 4" />
            <div className="min-w-0">
              <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
                Paso 4 de 4
              </p>
              <h1 className="font-display mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
                Estado de tu verificación
              </h1>
            </div>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/70 mt-2 text-sm leading-6">{summary}</p>

        <div className="consumer-card bg-surface border-ink/[0.08] mt-5 flex items-center gap-3 rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
          <Avatar
            name={profile?.display_name ?? "Tu perfil"}
            src={null}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">
              {profile?.display_name ?? "Sin nombre"}
            </p>
            <p className="text-ink/70 mt-0.5 truncate text-[13px]">
              {profile?.public_zone ?? "Sin zona"}
              {profile?.bio ? ` · ${profile.bio}` : null}
            </p>
          </div>
        </div>

        <section className="border-ink/[0.08] bg-surface divide-ink/[0.07] mt-5 divide-y rounded-2xl border px-3 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
          <div className="flex min-w-0 items-center gap-2.5">
            <IllustratedBadge tone="violet" icon="user" size="sm" label="Lo que cargaste" />
            <h2 className="font-display min-w-0 flex-1 truncate text-lg leading-7 font-bold">Lo que cargaste</h2>
          </div>
          <details className="border-ink/10 mt-3 border-y">
            <summary className="consumer-pressable flex min-h-14 cursor-pointer items-center justify-between gap-3 py-3 text-sm font-bold">
              Perfil público
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <dl className="space-y-2.5 pb-4 text-sm">
              <div>
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
                  Nombre visible
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {profile?.display_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
                  Zona
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {profile?.public_zone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
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
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
                  Nombre legal
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {privateProfile?.legal_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
                  DNI
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {maskPrivateReference(privateProfile?.dni_number ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-ink/70 text-xs font-bold tracking-[0.06em] uppercase">
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

        <div className="border-ink/[0.08] bg-surface consumer-card mt-5 overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
          <span
            className="brand-gradient-surface pointer-events-none block h-1.5"
            aria-hidden="true"
          />
          <div className="p-4">
          <span className="flex items-center gap-2">
            <IllustratedBadge tone="gold" icon="shield" size="sm" label={stateTitle} />
            <StatusChip tone={stateTone}>{stateTitle}</StatusChip>
          </span>
          <p className="text-ink/70 mt-2 text-sm leading-6">
            {pendingReview
              ? "Un administrador puede revisar ahora la evidencia privada y decidir el estado del perfil."
              : approved
                ? "No necesitás volver a enviar documentación desde este flujo."
                : rejected
                  ? "La documentación se conserva. Corregí lo observado y reenviala desde Documentos para una nueva revisión."
                  : readyForSubmission
                    ? "Volvé a Documentos y tocá “Enviar a revisión”."
                    : "Completá los elementos marcados como Revisar antes de enviar."}
          </p>
          {rejected && rejectionReason ? (
            <div className="border-danger/25 bg-danger/[0.04] mt-3 rounded-2xl border p-4">
              <p className="text-sm font-extrabold">Motivo del rechazo</p>
              <p className="text-ink/70 mt-1 text-sm leading-6">{rejectionReason}</p>
            </div>
          ) : null}
          {!pendingReview && !approved ? (
            <Link
              className="consumer-pressable cta-ink mt-3 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-6 text-[15px] font-extrabold sm:w-auto"
              href="/provider/onboarding/documents"
            >
              {rejected ? "Corregir y reenviar" : "Ir a documentos"}
            </Link>
          ) : null}
          </div>
        </div>

        <section className="mt-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <IllustratedBadge tone="green" icon="id" size="sm" label="Archivos recibidos" />
            <h2 className="font-display min-w-0 flex-1 truncate text-lg font-bold">Archivos recibidos</h2>
            <span className="text-ink/70 shrink-0 text-xs font-semibold">
              {receivedDocuments.length}
            </span>
          </div>

          {receivedDocuments.length > 0 ? (
            <ul className="border-ink/[0.08] bg-surface consumer-card divide-ink/[0.07] mt-2 divide-y rounded-2xl border px-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
            <EmptyState
              tone="blue"
              title="Todavía no hay documentos registrados"
              description="Subilos desde Documentos para completar la verificación."
              actionHref="/provider/onboarding/documents"
              actionLabel="Ir a documentos"
              className="border-ink/[0.08] bg-surface consumer-card mt-2 rounded-2xl border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
            />
          )}
        </section>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-6 text-[15px] font-extrabold sm:w-auto"
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
