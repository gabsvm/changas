import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { PrivateIdentityForm } from "@/components/account/account-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { PrivacyNotice } from "@/components/ui/privacy-notice";
import { createClient } from "@/lib/supabase/server";

import { saveProviderIdentityStep } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function ProviderOnboardingIdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding/identity");
  }

  const [{ data: provider }, { data: privateProfile }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select(
        "legal_name, private_phone, date_of_birth, exact_address, dni_number",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!provider || !canSelfManageProviderStatus(provider.status)) {
    redirect("/provider/onboarding");
  }

  const nextStep = Math.min(4, Math.max(provider.onboarding_step, 3));

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Identidad privada" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Paso 2 de 4
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Confirmá tus datos privados
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6">
          Esta información sirve para procesos internos de identidad y
          seguridad. No aparece en tu perfil público.
        </p>

        <div className="mt-5">
          <PrivacyNotice>
            Los datos legales se almacenan separados de tu presentación pública.
            El flujo de onboarding no cambia las reglas de acceso existentes.
          </PrivacyNotice>
        </div>

        <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
          <PrivateIdentityForm
            action={saveProviderIdentityStep}
            initialValues={{
              legalName: privateProfile?.legal_name ?? "",
              privatePhone: privateProfile?.private_phone ?? "",
              dateOfBirth: privateProfile?.date_of_birth ?? "",
              exactAddress: privateProfile?.exact_address ?? "",
              dniNumber: privateProfile?.dni_number ?? "",
            }}
            submitLabel="Guardar y continuar"
            hiddenFields={{ step: String(nextStep) }}
          />
        </div>

        <p className="text-ink/50 mt-4 text-xs leading-5">
          Al continuar guardamos tus datos privados y avanzamos directamente a
          la carga de documentos, sin pasos intermedios innecesarios.
        </p>
      </div>
    </section>
  );
}
