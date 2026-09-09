import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { PublicProfileForm } from "@/components/account/account-form";
import { ProfileAvatarUploader } from "@/components/account/profile-avatar-uploader";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";

import { saveProviderProfileStep } from "../../../actions";

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
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Tu perfil";

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Datos básicos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Paso 1 de 4
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Prepará tu perfil público
        </h1>
        <p className="text-ink/58 mt-2 text-sm leading-6">
          Mostrá lo esencial para que otras personas entiendan quién sos y cómo
          trabajás. Guardar este paso no publica servicios.
        </p>

        <section className="border-ink/10 mt-6 border-y py-4">
          <ProfileAvatarUploader
            displayName={displayName}
            initialAvatarUrl={profile?.avatar_url}
          />
        </section>

        <div className="mt-5">
          <PublicProfileForm
            action={saveProviderProfileStep}
            initialValues={{
              displayName: profile?.display_name ?? "",
              publicZone: profile?.public_zone ?? "",
              bio: profile?.bio ?? "",
            }}
            submitLabel="Guardar y continuar"
            hiddenFields={{ step: String(nextStep) }}
          />
        </div>
      </div>
    </section>
  );
}
