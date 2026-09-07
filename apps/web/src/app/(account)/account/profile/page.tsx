import { redirect } from "next/navigation";

import { PublicProfileForm } from "@/components/account/account-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";

import { updatePublicProfile } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, public_zone, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <section className="pb-4 sm:py-14">
      <MobileAppBar title="Perfil público" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Visible
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Así te van a ver
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6 sm:max-w-xl">
          Cuidá que tu nombre, zona y presentación expliquen rápido quién sos y
          cómo trabajás. Esta información puede aparecer en tu perfil público.
        </p>

        <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
          <PublicProfileForm
            action={updatePublicProfile}
            initialValues={{
              displayName: profile?.display_name ?? "",
              publicZone: profile?.public_zone ?? "",
              bio: profile?.bio ?? "",
              avatarUrl: profile?.avatar_url ?? "",
            }}
          />
        </div>
      </div>
    </section>
  );
}
