import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { updatePublicProfile } from "@/app/(account)/actions";
import { PublicProfileForm } from "@/components/account/account-form";
import { OnboardingAdvanceForm } from "@/components/provider/onboarding-advance-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";
import { getNextOnboardingHref } from "@/lib/ui/onboarding";

import { saveProviderOnboarding } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function ProviderOnboardingProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding/profile");
  }

  const [{ data: provider }, { data: profile }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!provider || !canSelfManageProviderStatus(provider.status)) {
    redirect("/provider/onboarding");
  }

  const nextStep = Math.min(4, Math.max(provider.onboarding_step, 2));

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Datos básicos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.16em] uppercase">
          Paso 1 de 4
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Prepará tu perfil público
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6">
          Estos son los datos que ayudan a que otras personas entiendan quién sos
          y cómo trabajás. Guardarlos no publica un servicio automáticamente.
        </p>

        <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(22,56,50,0.04)] sm:p-6">
          <PublicProfileForm
            action={updatePublicProfile}
            initialValues={{
              displayName: profile?.display_name ?? "",
              publicZone: profile?.public_zone ?? "",
              bio: profile?.bio ?? "",
              avatarUrl: profile?.avatar_url ?? "",
            }}
            submitLabel="Guardar datos básicos"
          />
        </div>

        <div className="border-ink/10 mt-5 border-t pt-5">
          <p className="text-ink/55 mb-3 text-xs leading-5">
            Cuando hayas guardado los cambios, avanzá al siguiente paso. Si ya
            habías avanzado antes, conservamos tu progreso más alto.
          </p>
          <OnboardingAdvanceForm
            action={saveProviderOnboarding}
            nextStep={nextStep}
            nextHref={getNextOnboardingHref(nextStep)}
            label="Continuar con identidad"
          />
        </div>
      </div>
    </section>
  );
}
