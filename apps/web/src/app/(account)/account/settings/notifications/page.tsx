import { redirect } from "next/navigation";

import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { getNotificationPreferences } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

import { updateNotificationPreferencesAction } from "../../notifications/actions";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account/settings/notifications");

  const preferences = await getNotificationPreferences(supabase);

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Notificaciones" backHref="/account/settings" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Configuración
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Notificaciones
        </h1>
        <p className="text-ink/60 mt-1.5 text-sm leading-6">
          Las alertas críticas dentro de Changas siguen disponibles aunque
          desactives canales externos.
        </p>
        <div className="consumer-card settings-card bg-surface divide-ink/[0.07] mt-5 divide-y px-4">
          <PushOptIn
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            initialEnabled={preferences.pushActionableEnabled}
          />
          <NotificationPreferencesForm
            action={updateNotificationPreferencesAction}
            initialValues={preferences}
          />
        </div>
      </div>
    </section>
  );
}
