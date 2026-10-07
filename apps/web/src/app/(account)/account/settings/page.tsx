import { SiteFooter } from "@/components/ui/site-footer";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ActionButton } from "@/components/ui/marketplace/action-button";
import { ThemeSelector } from "@/components/ui/marketplace/theme-selector";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
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
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Configuración" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
          Cuenta
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Configuración
        </h1>
        <p className="text-ink/70 mt-1.5 text-sm leading-6">
          Acceso, preferencias y datos de tu cuenta.
        </p>

        <section className="border-ink/10 divide-ink/10 mt-5 divide-y border-y">
          <div className="py-3">
            <p className="text-ink text-[0.95rem] font-semibold">Apariencia</p>
            <p className="text-ink/70 mt-0.5 text-sm leading-5">
              Claro, oscuro o igual que tu sistema. Se guarda en este
              dispositivo.
            </p>
            <ThemeSelector />
          </div>
          <SettingsRow
            href="/account/settings/notifications"
            title="Notificaciones"
            description="Alertas, recordatorios y preferencias"
          />
          <SettingsRow
            href="/account/profile"
            title="Perfil público"
            description="Nombre, zona, foto y presentación"
          />
          <SettingsRow
            href="/account/identity"
            title="Identidad privada"
            description="Datos legales que no se publican"
          />
          <SettingsRow
            href="/update-password"
            title="Cambiar contraseña"
            description="Elegí una nueva clave de acceso"
          />
        </section>

        <SiteFooter className="mt-8" />

        <form action={signOut} className="border-ink/10 mt-7 border-t pt-5">
          <ActionButton
            tone="danger"
            type="submit"
            className="w-full sm:w-auto"
          >
            Cerrar sesión
          </ActionButton>
        </form>
        <Link
          href="/account/settings/delete"
          className="text-ink/60 hover:text-danger mt-4 inline-block text-sm font-semibold underline underline-offset-4"
        >
          Eliminar mi cuenta
        </Link>
      </div>
    </section>
  );
}
