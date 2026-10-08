import { redirect } from "next/navigation";

import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
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
        <div className="flex items-center gap-3">
          <IllustratedBadge tone="gold" icon="bell" size="md" label="Notificaciones" />
          <div>
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Configuración
            </p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
              Notificaciones
            </h1>
          </div>
        </div>
        <p className="text-ink/70 mt-1.5 text-sm leading-6">
          Las alertas críticas dentro de Changas siguen disponibles aunque
          desactives canales externos.
        </p>
        <div className="consumer-card settings-card bg-surface divide-ink/[0.07] border-ink/[0.08] mt-5 divide-y rounded-2xl border px-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
