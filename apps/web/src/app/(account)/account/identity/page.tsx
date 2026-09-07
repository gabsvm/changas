import { redirect } from "next/navigation";

import { PrivateIdentityForm } from "@/components/account/account-form";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { PrivacyNotice } from "@/components/ui/privacy-notice";
import { createClient } from "@/lib/supabase/server";

import { updatePrivateIdentity } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AccountIdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/identity");
  }

  const { data: privateProfile } = await supabase
    .from("profile_private")
    .select(
      "legal_name, private_phone, date_of_birth, exact_address, dni_number",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <section className="pb-4 sm:py-14">
      <MobileAppBar title="Identidad privada" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Privado
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Tus datos de identidad
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6 sm:max-w-xl">
          Usamos estos datos para procesos internos de identidad y seguridad. No
          forman parte de tu perfil público.
        </p>

        <div className="mt-5">
          <PrivacyNotice>
            Tu nombre legal, teléfono, fecha de nacimiento, DNI y domicilio
            exacto se guardan separados de la información pública del perfil.
          </PrivacyNotice>
        </div>

        <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
          <PrivateIdentityForm
            action={updatePrivateIdentity}
            initialValues={{
              legalName: privateProfile?.legal_name ?? "",
              privatePhone: privateProfile?.private_phone ?? "",
              dateOfBirth: privateProfile?.date_of_birth ?? "",
              exactAddress: privateProfile?.exact_address ?? "",
              dniNumber: privateProfile?.dni_number ?? "",
            }}
          />
        </div>
      </div>
    </section>
  );
}
