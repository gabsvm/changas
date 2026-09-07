import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { PublicProfileForm } from "@/components/account/account-form";
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

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Datos básicos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Paso 1 de 4
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Prepará tu perfil público
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6">
          Estos son los datos que ayudan a que otras personas entiendan quién
          sos y cómo trabajás. Guardarlos no publica un servicio
          automáticamente.
        </p>

        <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
          <PublicProfileForm
            action={saveProviderProfileStep}
            initialValues={{
              displayName: profile?.display_name ?? "",
              publicZone: profile?.public_zone ?? "",
              bio: profile?.bio ?? "",
              avatarUrl: profile?.avatar_url ?? "",
            }}
            submitLabel="Guardar y continuar"
            hiddenFields={{ step: String(nextStep) }}
          />
        </div>

        <p className="text-ink/50 mt-4 text-xs leading-5">
          Al continuar guardamos estos cambios y conservamos cualquier progreso
          más avanzado que ya tuviera tu verificación.
        </p>
      </div>
    </section>
  );
}
