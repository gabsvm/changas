import { redirect } from "next/navigation";

import { AccountForm } from "@/components/account/account-form";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "../../../(auth)/actions";
import { updateAccount } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/settings");
  }

  const [{ data: profile }, { data: privateProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select(
        "legal_name, private_phone, date_of_birth, exact_address, dni_number",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
          Configuración
        </p>
        <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
          Tus datos
        </h1>
        <p className="text-ink/65 mt-4 text-sm leading-6">
          Correo de acceso: {user.email ?? "sin correo"}. Los datos públicos y
          privados se guardan en límites separados.
        </p>
      </div>
      <div className="mt-10 max-w-3xl">
        <AccountForm
          action={updateAccount}
          initialValues={{
            displayName: profile?.display_name ?? "",
            publicZone: profile?.public_zone ?? "",
            bio: profile?.bio ?? "",
            avatarUrl: profile?.avatar_url ?? "",
            legalName: privateProfile?.legal_name ?? "",
            privatePhone: privateProfile?.private_phone ?? "",
            dateOfBirth: privateProfile?.date_of_birth ?? "",
            exactAddress: privateProfile?.exact_address ?? "",
            dniNumber: privateProfile?.dni_number ?? "",
          }}
        />
        <form action={signOut} className="border-ink/10 mt-10 border-t pt-6">
          <button
            className="text-terracotta text-sm font-semibold underline underline-offset-4"
            type="submit"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </section>
  );
}
