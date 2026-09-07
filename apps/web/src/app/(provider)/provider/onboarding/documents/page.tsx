import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { DocumentListItem } from "@/components/provider/document-list-item";
import { DocumentUploader } from "@/components/provider/document-uploader";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { PrivacyNotice } from "@/components/ui/privacy-notice";
import { createClient } from "@/lib/supabase/server";

import {
  saveProviderOnboarding,
  uploadIdentityDocument,
} from "../../../actions";

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

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Documentos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-3xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.16em] uppercase">
          Paso 3 de 4
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Documentos de identidad
        </h1>
        <p className="text-ink/60 mt-3 max-w-2xl text-sm leading-6">
          Cargá fotos claras o un PDF. Solo mostramos en pantalla el tipo y la
          fecha de recepción; la ruta del archivo permanece privada.
        </p>

        <div className="mt-5">
          <PrivacyNotice title="Carga privada y controlada">
            El archivo sigue pasando por la validación y el server action
            existentes. No se sube desde código cliente arbitrario ni se expone
            la ubicación del Storage.
          </PrivacyNotice>
        </div>

        <div className="mt-6">
          <DocumentUploader
            key={`document-uploader-${receivedDocuments.length}`}
            action={uploadIdentityDocument}
            editable={editable}
          />
        </div>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.14em] uppercase">
                Recibidos
              </p>
              <h2 className="font-display mt-1 text-2xl font-semibold">
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
            <p className="border-ink/10 bg-surface text-ink/55 mt-4 rounded-2xl border px-4 py-4 text-sm">
              Todavía no hay documentos registrados.
            </p>
          )}
        </section>

        {editable ? (
          <div className="border-ink/10 mt-6 border-t pt-5">
            <p className="text-ink/55 mb-3 text-xs leading-5">
              Podés continuar a la revisión con el progreso que ya tengas. El
              servidor conserva sus reglas actuales y no inventamos requisitos
              adicionales en la interfaz.
            </p>
            <OnboardingAdvanceForm
              action={saveProviderOnboarding}
              nextStep={4}
              nextHref="/provider/onboarding/review"
              label="Continuar a revisión"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
