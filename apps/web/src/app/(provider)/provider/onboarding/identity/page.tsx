import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { PrivateIdentityForm } from "@/components/account/account-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
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
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-center gap-3">
          <IllustratedBadge tone="green" icon="shield" size="md" label="Paso 2 de 4" />
          <div>
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Paso 2 de 4
            </p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
              Confirmá tus datos privados
            </h1>
          </div>
        </div>
        <p className="text-ink/70 mt-2 text-sm leading-6">
          Estos datos sirven para identidad y seguridad. Nunca forman parte de
          tu perfil público.
        </p>

        <div className="mt-4">
          <PrivacyNotice>
            Nombre legal, teléfono, fecha de nacimiento, DNI y domicilio se
            guardan separados de tu información pública.
          </PrivacyNotice>
        </div>

        <div className="border-ink/10 mt-5 border-t pt-5">
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
      </div>
    </section>
  );
}
