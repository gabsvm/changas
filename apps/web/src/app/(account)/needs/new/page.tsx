import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { NeedWizard } from "./need-wizard";
import { createClient } from "@/lib/supabase/server";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { NeedsComingSoon } from "@/components/jobs/needs-coming-soon";


export const metadata = {
  title: "Publicar necesidad | YALO",
  description:
    "Contanos qué necesitás y recibí ofertas de prestadores verificados.",
};

export default async function NewNeedPage() {
  if (!arePublicNeedsEnabled()) return <NeedsComingSoon />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/needs/new");

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Publicar necesidad" backHref="/jobs" />
      <p className="text-ink/70 mt-2 text-[15px] leading-6">
        Contanos qué necesitás y compará las cotizaciones. El pago se acuerda
        por fuera de YALO; contratar no implica un adelanto.
      </p>
      <NeedWizard
        skills={(skills ?? []).map((skill) => ({ id: skill.id, name: skill.name }))}
        idempotencyKey={randomUUID()}
      />
    </main>
  );
}
