import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentListItem } from "@/components/provider/document-list-item";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

import { saveProviderOnboarding } from "../../../actions";

export const dynamic = "force-dynamic";

function CompletionRow({
  label,
  complete,
  href,
}: {
  label: string;
  complete: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-ink/10 hover:bg-moss/5 flex min-h-14 items-center justify-between gap-4 border-b py-3 transition-colors last:border-b-0"
    >
      <span className="text-sm font-bold">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.06em] uppercase ${
          complete
            ? "bg-success/10 text-success"
            : "bg-brand-yellow/18 text-warning"
        }`}
      >
        {complete ? "Completo" : "Revisar"}
      </span>
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
      .select("document_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!provider) {
    redirect("/provider/onboarding");
  }

  const editable = canSelfManageProviderStatus(provider.status);
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
  const documentsComplete = receivedDocuments.length > 0;

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Revisión" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-3xl pt-6 sm:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
              Paso 4 de 4
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              Revisá lo cargado
            </h1>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/60 mt-3 max-w-2xl text-sm leading-6">
          Esta pantalla resume tu progreso. No significa que el perfil esté
          aprobado: la habilitación continúa dependiendo del estado real y de la
          revisión correspondiente.
        </p>

        <section className="border-ink/10 bg-surface mt-6 rounded-3xl border px-5 py-2 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:px-6">
          <CompletionRow
            label="Perfil público"
            complete={publicComplete}
            href="/provider/onboarding/profile"
          />
          <CompletionRow
            label="Identidad privada"
            complete={privateComplete}
            href="/provider/onboarding/identity"
          />
          <CompletionRow
            label="Documentos"
            complete={documentsComplete}
            href="/provider/onboarding/documents"
          />
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
                Documentos privados
              </p>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                Archivos recibidos
              </h2>
            </div>
            <span className="text-ink/45 text-xs font-semibold">
              {receivedDocuments.length}
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

        {editable && provider.onboarding_step < 4 ? (
          <div className="border-ink/10 mt-6 border-t pt-5">
            <OnboardingAdvanceForm
              action={saveProviderOnboarding}
              nextStep={4}
              nextHref="/provider/onboarding/review"
              label="Guardar este paso"
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

        <p className="text-ink/50 mt-5 text-xs leading-5">
          Changas no cambia tu perfil a activo desde esta pantalla. Los estados
          de revisión y habilitación siguen controlados por la lógica existente.
        </p>
      </div>
    </section>
  );
}
