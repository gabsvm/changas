import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { PublicProfileForm } from "@/components/account/account-form";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { ProfileAvatarUploader } from "@/components/account/profile-avatar-uploader";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
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
  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "Tu perfil";

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Datos básicos" backHref="/provider/onboarding" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-center gap-3">
          <IllustratedBadge tone="violet" icon="user" size="md" label="Paso 1 de 4" />
          <div>
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Paso 1 de 4
            </p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
              Prepará tu perfil público
            </h1>
          </div>
        </div>
        <p className="text-ink/70 mt-2 text-sm leading-6">
          Mostrá lo esencial para que otras personas entiendan quién sos y cómo
          trabajás. Guardar este paso no publica servicios.
        </p>

        <div
          className="consumer-card bg-surface border-ink/[0.08] mt-5 flex items-center gap-3 rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
          aria-label="Vista previa de tu perfil"
        >
          <Avatar
            name={displayName}
            src={profile?.avatar_url ?? null}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">{displayName}</p>
            <p className="text-ink/70 mt-0.5 truncate text-[13px]">
              {profile?.public_zone ?? "Sin zona"}
              {profile?.bio ? ` · ${profile.bio}` : null}
            </p>
          </div>
        </div>

        <section className="border-ink/[0.08] bg-surface mt-6 rounded-2xl border px-4 py-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
