import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { NeedWizard } from "./need-wizard";
import { createClient } from "@/lib/supabase/server";
import { filterPublicSkillsByCategoryId, isExcludedPublicTestCategory } from "@/lib/public-catalog";
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

  const [{ data: skills }, { data: categories }] = await Promise.all([
    supabase
      .from("skills")
      .select("id, name, category_id")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("id, slug, name")
      .eq("is_active", true),
  ]);
  const excludedCategoryIds = new Set(
    (categories ?? [])
      .filter((category) => isExcludedPublicTestCategory(category))
      .map((category) => category.id),
  );
  const publicSkills = categories
    ? filterPublicSkillsByCategoryId(skills ?? [], excludedCategoryIds)
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Publicar necesidad" backHref="/jobs" />
      <p className="text-ink/70 mt-2 text-[15px] leading-6">
        Contanos qué necesitás y compará las cotizaciones. El pago se acuerda
        por fuera de YALO; contratar no implica un adelanto.
      </p>
      <NeedWizard
        skills={publicSkills.map((skill) => ({ id: skill.id, name: skill.name }))}
        idempotencyKey={randomUUID()}
      />
    </main>
  );
}
