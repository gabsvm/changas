import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { uploadIdentityDocument } from "@/app/(provider)/actions";
import { DocumentListItem } from "@/components/provider/document-list-item";
import { DocumentUploader } from "@/components/provider/document-uploader";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { PrivacyNotice } from "@/components/ui/privacy-notice";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { createClient } from "@/lib/supabase/server";
import { getDocumentTypeLabel } from "@/lib/ui/documents";
import {
  hasRequiredIdentityDocuments,
  missingRequiredIdentityDocuments,
  requiredIdentityDocumentTypes,
} from "@/lib/ui/provider-submission";

import { submitProviderIdentityReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProviderOnboardingDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding/documents");
  }

  const [{ data: provider }, { data: documents }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
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

  const submitted =
    provider.status === "IDENTITY_PENDING" ||
    provider.status === "UNDER_REVIEW";
  const editable = canSelfManageProviderStatus(provider.status) && !submitted;
  const rejected = provider.status === "REJECTED";
  const receivedDocuments = documents ?? [];
  const documentsComplete = hasRequiredIdentityDocuments(receivedDocuments);
  const missingDocuments = missingRequiredIdentityDocuments(receivedDocuments);
  const receivedTypes = new Set(
    receivedDocuments.map((document) => document.document_type),
  );

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Documentos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-center gap-3">
          <IllustratedBadge tone="blue" icon="doc" size="md" label="Paso 3 de 4" />
          <div>
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Paso 3 de 4
            </p>
            <h1 className="font-display mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
              Verificá tu identidad
            </h1>
          </div>
        </div>
        <p className="text-ink/70 mt-2 text-sm leading-6">
          Necesitamos frente y dorso del DNI más una selfie. Subir archivos no
          envía el caso: vos decidís cuándo mandarlo a revisión.
        </p>

        <div className="mt-4">
          <PrivacyNotice title="Carga privada">
            Los archivos quedan en almacenamiento privado y sólo se habilita
            acceso controlado durante la revisión.
          </PrivacyNotice>
        </div>

        <section className="border-ink/[0.08] bg-surface mt-5 rounded-2xl border px-4 py-3 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Requisitos</p>
              <p className="text-ink/70 mt-0.5 text-xs">
                {receivedDocuments.length}/3 recibidos
              </p>
            </div>
            <StatusChip
              tone={
                submitted ? "info" : documentsComplete ? "success" : "warning"
              }
            >
              {submitted
                ? "En revisión"
                : documentsComplete
                  ? "Listo para enviar"
                  : "Faltan documentos"}
            </StatusChip>
          </div>

          <div className="divide-ink/10 mt-3 divide-y">
            {requiredIdentityDocumentTypes.map((type) => {
              const present = receivedTypes.has(type);
              return (
                <div
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                  key={type}
                >
                  <span className="text-sm font-semibold">
                    {getDocumentTypeLabel(type)}
                  </span>
                  <StatusChip tone={present ? "success" : "neutral"}>
                    {present ? "Recibido" : "Pendiente"}
                  </StatusChip>
                </div>
              );
            })}
          </div>
        </section>

        {submitted ? (
          <div className="border-moss/20 bg-moss/[0.06] mt-5 rounded-xl border px-4 py-3">
            <p className="text-moss text-sm font-bold">Identidad enviada</p>
            <p className="text-ink/70 mt-1 text-sm leading-6">
              La evidencia queda bloqueada mientras un administrador revisa el
              caso.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <DocumentUploader
              key={`document-uploader-${receivedDocuments.length}`}
              action={uploadIdentityDocument}
              editable={editable}
            />
          </div>
        )}

        <section id="documentos" className="mt-6 scroll-mt-24">
          <div className="flex min-w-0 items-center gap-2.5">
            <IllustratedBadge tone="green" icon="id" size="sm" label="Tus documentos" />
            <h2 className="font-display min-w-0 flex-1 truncate text-lg font-bold">Tus documentos</h2>
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
              description="Subí frente y dorso del DNI más una selfie desde el cargador de arriba."
              className="border-ink/[0.08] bg-surface consumer-card mt-2 rounded-2xl border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
            />
          )}
        </section>

        {editable ? (
          <StickyActionBar className="mt-6">
            {documentsComplete ? (
              <div>
                <p className="text-ink/70 mb-2 text-xs leading-5">
                  Al enviar, la evidencia entra en la cola administrativa de
                  revisión.
                </p>
                <OnboardingAdvanceForm
                  action={submitProviderIdentityReview}
                  nextStep={4}
                  nextHref="/provider/onboarding/review"
                  label={rejected ? "Reenviar a revisión" : "Enviar a revisión"}
                />
              </div>
            ) : (
              <div>
                <p className="text-ink/70 mb-2 text-xs leading-5">
                  Faltan:{" "}
                  {missingDocuments.map(getDocumentTypeLabel).join(", ")}.
                </p>
                <button
                  className="button-primary w-full opacity-50 sm:w-auto"
                  type="button"
                  disabled
                >
                  {rejected ? "Reenviar a revisión" : "Enviar a revisión"}
                </button>
              </div>
            )}
          </StickyActionBar>
        ) : null}
      </div>
    </section>
  );
}
