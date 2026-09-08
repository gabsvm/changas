import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { DocumentListItem } from "@/components/provider/document-list-item";
import { DocumentUploader } from "@/components/provider/document-uploader";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { PrivacyNotice } from "@/components/ui/privacy-notice";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { createClient } from "@/lib/supabase/server";
import { getDocumentTypeLabel } from "@/lib/ui/documents";
import {
  hasRequiredIdentityDocuments,
  missingRequiredIdentityDocuments,
  requiredIdentityDocumentTypes,
} from "@/lib/ui/provider-submission";

import {
  submitProviderIdentityReview,
  uploadProviderIdentityDocument,
} from "./actions";

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

  const editable = canSelfManageProviderStatus(provider.status);
  const receivedDocuments = documents ?? [];
  const documentsComplete = hasRequiredIdentityDocuments(receivedDocuments);
  const missingDocuments = missingRequiredIdentityDocuments(receivedDocuments);

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Documentos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-3xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Paso 3 de 4
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Verificá tu identidad
        </h1>
        <p className="text-ink/60 mt-3 max-w-2xl text-sm leading-6">
          Para enviar tu perfil a revisión necesitamos tres evidencias: frente y
          dorso del DNI, más una selfie de validación. Subir archivos no envía el
          caso automáticamente: vos decidís cuándo está listo.
        </p>

        <div className="mt-5">
          <PrivacyNotice title="Carga privada y controlada">
            Los archivos quedan en almacenamiento privado. El panel
            administrativo sólo genera acceso temporal al documento exacto
            durante la revisión.
          </PrivacyNotice>
        </div>

        <section className="border-ink/10 bg-surface mt-6 rounded-3xl border p-4 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
                Requisitos
              </p>
              <h2 className="mt-1 text-lg font-extrabold">
                {receivedDocuments.length}/3 recibidos
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                documentsComplete
                  ? "bg-success/10 text-success"
                  : "bg-brand-yellow/20 text-warning"
              }`}
            >
              {documentsComplete ? "Listo para enviar" : "Faltan documentos"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {requiredIdentityDocumentTypes.map((type) => {
              const present = receivedDocuments.some(
                (document) => document.document_type === type,
              );
              return (
                <div
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold ${
                    present
                      ? "border-success/20 bg-success/8 text-success"
                      : "border-ink/10 bg-canvas text-ink/55"
                  }`}
                  key={type}
                >
                  {present ? "✓ " : "○ "}
                  {getDocumentTypeLabel(type)}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-6">
          <DocumentUploader
            key={`document-uploader-${receivedDocuments.length}`}
            action={uploadProviderIdentityDocument}
            editable={editable}
          />
        </div>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
                Recibidos
              </p>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                Tus documentos
              </h2>
            </div>
            <span className="text-ink/45 text-xs font-semibold">
              {receivedDocuments.length} cargado
              {receivedDocuments.length === 1 ? "" : "s"}
            </span>
          </div>

          {receivedDocuments.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {receivedDocuments.map((document) => (
                <DocumentListItem
                  key={`${document.document_type}-${document.created_at}`}
                  documentType={document.document_type}
                  createdAt={document.created_at}
                />
              ))}
            </ul>
          ) : (
            <p className="border-ink/10 bg-surface text-ink/55 mt-4 rounded-2xl border px-4 py-4 text-sm shadow-[0_8px_24px_rgba(32,33,36,0.025)]">
              Todavía no hay documentos registrados.
            </p>
          )}
        </section>

        {editable ? (
          <StickyActionBar className="mt-6">
            <div className="sm:border-ink/10 sm:border-t sm:pt-5">
              {documentsComplete ? (
                <>
                  <p className="text-ink/55 mb-3 text-xs leading-5">
                    Al enviar, tu caso aparecerá en la cola de revisión y un
                    administrador podrá aprobarlo o rechazarlo.
                  </p>
                  <OnboardingAdvanceForm
                    action={submitProviderIdentityReview}
                    nextStep={4}
                    nextHref="/provider/onboarding/review"
                    label="Enviar a revisión"
                  />
                </>
              ) : (
                <>
                  <p className="text-ink/55 mb-3 text-xs leading-5">
                    Faltan: {missingDocuments.map(getDocumentTypeLabel).join(", ")}.
                  </p>
                  <button
                    className="button-primary w-full opacity-50 sm:w-auto"
                    type="button"
                    disabled
                  >
                    Enviar a revisión
                  </button>
                </>
              )}
            </div>
          </StickyActionBar>
        ) : null}
      </div>
    </section>
  );
}
