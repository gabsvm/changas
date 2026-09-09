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

  if (!user) redirect("/login?next=/account/identity");

  const { data: privateProfile } = await supabase
    .from("profile_private")
    .select("legal_name, private_phone, date_of_birth, exact_address, dni_number")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <section className="pb-4 sm:py-10">
      <MobileAppBar title="Identidad y seguridad" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <header>
          <h1 className="hidden text-3xl font-bold tracking-[-0.035em] sm:block">
            Identidad y seguridad
          </h1>
          <p className="text-ink/52 text-sm leading-6 sm:mt-1 sm:max-w-xl">
            Estos datos se usan sólo en procesos internos de identidad y seguridad.
          </p>
        </header>

        <div className="mt-4">
          <PrivacyNotice>
            Tu nombre legal, teléfono, fecha de nacimiento, DNI y domicilio exacto se guardan separados del perfil público.
          </PrivacyNotice>
        </div>

        <div className="mt-6">
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
