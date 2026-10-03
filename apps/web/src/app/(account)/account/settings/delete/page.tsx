import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";

import { deleteAccount } from "./actions";
import { DeleteAccountForm } from "./delete-account-form";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/settings/delete");
  }

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Eliminar cuenta" backHref="/account/settings" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <h1 className="text-3xl font-extrabold tracking-[-0.035em]">
          Eliminar cuenta
        </h1>
        <p className="text-ink/70 mt-2 text-sm leading-6">
          Vamos a borrar tus datos personales, tus documentos de identidad y tus
          avisos, y a despublicar tus servicios. No vas a poder volver a entrar
          con esta cuenta.
        </p>
        <p className="text-ink/70 mt-2 text-sm leading-6">
          Los trabajos, pagos y reseñas ya realizados se conservan sin tu nombre
          por obligaciones contables y para resolver reclamos de la otra
          persona.
        </p>
        <DeleteAccountForm action={deleteAccount} />
      </div>
    </section>
  );
}
