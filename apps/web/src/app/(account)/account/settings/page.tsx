import { SiteFooter } from "@/components/ui/site-footer";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ActionButton } from "@/components/ui/marketplace/action-button";
import { ThemeSelector } from "@/components/ui/marketplace/theme-selector";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
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
        <div className="flex items-center gap-3">
          <IllustratedBadge tone="neutral" icon="gear" size="md" label="Configuración" />
          <div>
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Cuenta
            </p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
              Configuración
            </h1>
          </div>
        </div>
        <p className="text-ink/70 mt-1.5 text-sm leading-6">
          Acceso, preferencias y datos de tu cuenta.
        </p>

        <section className="border-ink/[0.08] bg-surface divide-ink/[0.07] mt-5 divide-y rounded-2xl border px-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
            leading={<IllustratedBadge tone="gold" icon="bell" size="sm" />}
          />
          <SettingsRow
            href="/account/profile"
            title="Perfil público"
            description="Nombre, zona, foto y presentación"
            leading={<IllustratedBadge tone="violet" icon="user" size="sm" />}
          />
          <SettingsRow
            href="/account/identity"
            title="Identidad privada"
            description="Datos legales que no se publican"
            leading={<IllustratedBadge tone="green" icon="shield" size="sm" />}
          />
          <SettingsRow
            href="/update-password"
            title="Cambiar contraseña"
            description="Elegí una nueva clave de acceso"
            leading={<IllustratedBadge tone="blue" icon="tag" size="sm" />}
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
