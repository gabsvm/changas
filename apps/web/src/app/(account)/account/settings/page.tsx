import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "../../../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/settings");
  }

  return (
    <section className="pb-4 sm:py-14">
      <MobileAppBar title="Configuración" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Cuenta
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Configuración
        </h1>
        <p className="text-ink/60 mt-3 text-sm leading-6">
          Gestioná las preferencias de tu cuenta y el acceso a Changas.
        </p>

        <section className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] sm:p-6">
          <p className="text-ink/45 text-xs font-bold tracking-[0.12em] uppercase">
            Correo de acceso
          </p>
          <p className="mt-2 text-sm font-bold break-all">
            {user.email ?? "Sin correo disponible"}
          </p>
        </section>

        <section className="border-ink/10 bg-surface mt-5 overflow-hidden rounded-3xl border shadow-[0_8px_24px_rgba(32,33,36,0.03)]">
          <Link
            href="/account/notifications"
            className="border-ink/10 hover:bg-moss/5 hover:text-moss flex min-h-14 items-center justify-between gap-4 border-b px-5 py-3 text-sm font-bold transition-colors"
          >
            <span>Notificaciones</span>
            <span className="text-ink/40" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/account/profile"
            className="border-ink/10 hover:bg-moss/5 hover:text-moss flex min-h-14 items-center justify-between gap-4 border-b px-5 py-3 text-sm font-bold transition-colors"
          >
            <span>Perfil público</span>
            <span className="text-ink/40" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/account/identity"
            className="hover:bg-moss/5 hover:text-moss flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-sm font-bold transition-colors"
          >
            <span>Identidad privada</span>
            <span className="text-ink/40" aria-hidden="true">
              ›
            </span>
          </Link>
        </section>

        <form action={signOut} className="border-ink/10 mt-8 border-t pt-6">
          <button
            className="border-danger/20 text-danger hover:bg-danger/5 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm font-bold transition-colors sm:w-auto"
            type="submit"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </section>
  );
}
