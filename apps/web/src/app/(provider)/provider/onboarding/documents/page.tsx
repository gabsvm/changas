import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { uploadIdentityDocument } from "@/app/(provider)/actions";
import { DocumentListItem } from "@/components/provider/document-list-item";
import { DocumentUploader } from "@/components/provider/document-uploader";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
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
      .select("document_type, created_at")
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
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Paso 3 de 4
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Verificá tu identidad
        </h1>
        <p className="text-ink/58 mt-2 text-sm leading-6">
          Necesitamos frente y dorso del DNI más una selfie. Subir archivos no
          envía el caso: vos decidís cuándo mandarlo a revisión.
        </p>

        <div className="mt-4">
          <PrivacyNotice title="Carga privada">
            Los archivos quedan en almacenamiento privado y sólo se habilita
            acceso controlado durante la revisión.
          </PrivacyNotice>
        </div>

        <section className="border-ink/10 mt-5 border-y py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Requisitos</p>
              <p className="text-ink/45 mt-0.5 text-xs">
                {receivedDocuments.length}/3 recibidos
              </p>
            </div>
            <StatusChip
              tone={submitted ? "info" : documentsComplete ? "success" : "warning"}
            >
              {submitted
                ? "En revisión"
                : documentsComplete
                  ? "Listo para enviar"
                  : "Faltan documentos"}
            </StatusChip>
          </div>

          <div className="mt-3 divide-y divide-ink/10">
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
            <p className="text-ink/58 mt-1 text-sm leading-6">
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

        <section className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Tus documentos</h2>
            <span className="text-ink/45 text-xs font-semibold">
              {receivedDocuments.length}
            </span>
          </div>

          {receivedDocuments.length > 0 ? (
            <ul className="border-ink/10 mt-2 divide-y divide-ink/10 border-y">
              {receivedDocuments.map((document) => (
                <DocumentListItem
                  key={`${document.document_type}-${document.created_at}`}
                  documentType={document.document_type}
                  createdAt={document.created_at}
                />
              ))}
            </ul>
          ) : (
            <p className="text-ink/50 border-ink/10 mt-2 border-y py-4 text-sm">
              Todavía no hay documentos registrados.
            </p>
          )}
        </section>

        {editable ? (
          <StickyActionBar className="mt-6">
            {documentsComplete ? (
              <div>
                <p className="text-ink/50 mb-2 text-xs leading-5">
                  Al enviar, la evidencia entra en la cola administrativa de
                  revisión.
                </p>
                <OnboardingAdvanceForm
                  action={submitProviderIdentityReview}
                  nextStep={4}
                  nextHref="/provider/onboarding/review"
                  label="Enviar a revisión"
                />
              </div>
            ) : (
              <div>
                <p className="text-ink/50 mb-2 text-xs leading-5">
                  Faltan: {missingDocuments.map(getDocumentTypeLabel).join(", ")}.
                </p>
                <button
                  className="button-primary w-full opacity-50 sm:w-auto"
                  type="button"
                  disabled
                >
                  Enviar a revisión
                </button>
              </div>
            )}
          </StickyActionBar>
        ) : null}
      </div>
    </section>
  );
}
