import { redirect } from "next/navigation";

import { PublicProfileForm } from "@/components/account/account-form";
import { ProfileAvatarUploader } from "@/components/account/profile-avatar-uploader";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";

import { updatePublicProfile } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, public_zone, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "Tu perfil";

  return (
    <section className="pb-4 sm:py-10">
      <MobileAppBar title="Perfil público" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <header className="mb-6">
          <h1 className="hidden text-3xl font-bold tracking-[-0.035em] sm:block">
            Perfil público
          </h1>
          <p className="text-ink/52 text-sm leading-6 sm:mt-1 sm:max-w-xl">
            Esta información puede aparecer en tus servicios y conversaciones.
          </p>
        </header>

        <section className="border-b border-ink/[0.07] pb-5">
          <ProfileAvatarUploader
            displayName={displayName}
            initialAvatarUrl={profile?.avatar_url}
          />
        </section>

        <div className="mt-5">
          <PublicProfileForm
            action={updatePublicProfile}
            initialValues={{
              displayName: profile?.display_name ?? "",
              publicZone: profile?.public_zone ?? "",
              bio: profile?.bio ?? "",
            }}
          />
        </div>
      </div>
    </section>
  );
}
