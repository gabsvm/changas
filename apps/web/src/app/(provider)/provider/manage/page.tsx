import Link from "next/link";
import { redirect } from "next/navigation";

import { MarketplaceManagement } from "@/components/provider/marketplace-management";
import { createClient } from "@/lib/supabase/server";

import {
  deleteAvailabilityBlock,
  deleteAvailabilityRule,
  deleteCertification,
  deleteEducation,
  deleteExperience,
  deletePortfolioItem,
  deleteService,
  deleteServiceArea,
  removeProviderSkill,
  saveAvailabilityBlock,
  saveAvailabilityRule,
  saveCertification,
  saveEducation,
  saveExperience,
  savePortfolioItem,
  saveProviderSkill,
  saveService,
  saveServiceArea,
  toggleServicePause,
  updateMarketplaceSettings,
} from "../../marketplace-actions";

export const dynamic = "force-dynamic";

export default async function ProviderMarketplaceManagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/provider/manage");

  const [
    { data: provider },
    { data: profile },
    { data: skills },
    { data: categories },
    { data: providerSkills },
    { data: services },
    { data: experiences },
    { data: education },
    { data: certifications },
    { data: portfolioItems },
    { data: serviceAreas },
    { data: availabilityRules },
    { data: availabilityBlocks },
  ] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select(
        "status, public_slug, public_headline, marketplace_paused, availability_paused",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("skills")
      .select("id, name, slug, category_id")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("provider_skills")
      .select("skill_id, is_featured, sort_order")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase
      .from("services")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase
      .from("experiences")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase
      .from("education")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase
      .from("certifications")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("sort_order"),
    supabase.from("service_areas").select("*").eq("provider_user_id", user.id),
    supabase
      .from("availability_rules")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("weekday"),
    supabase
      .from("availability_blocks")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("starts_at"),
  ]);

  if (!provider) {
    return (
      <section className="py-10 sm:py-14">
        <Link
          className="text-ink/60 text-sm underline underline-offset-4"
          href="/provider/onboarding"
        >
          ← Preparar onboarding
        </Link>
        <div className="border-ink/10 mt-8 max-w-2xl rounded-2xl border bg-white/65 p-7">
          <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
            Proveedor
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold">
            Primero prepará tu perfil
          </h1>
          <p className="text-ink/65 mt-4 text-sm leading-6">
            La gestión del marketplace se habilita después de crear el espacio
            privado de proveedor.
          </p>
          <Link className="button-primary mt-6" href="/provider/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </section>
    );
  }

  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );
  const marketplaceSkills = (skills ?? []).map((skill) => ({
    ...skill,
    category_name: categoryNames.get(skill.category_id) ?? "Catálogo",
  }));
  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "proveedor";

  return (
    <section className="py-10 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            className="text-ink/60 text-sm underline underline-offset-4"
            href="/account"
          >
            ← Volver a mi cuenta
          </Link>
          <p className="text-terracotta mt-8 text-xs font-semibold tracking-[0.18em] uppercase">
            Gestión de proveedor
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            Tu marketplace, {displayName}
          </h1>
          <p className="text-ink/65 mt-5 max-w-2xl text-sm leading-6">
            Prepará habilidades, servicios, trayectoria y disponibilidad. Nada
            de esta pantalla crea reservas ni propuestas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="bg-moss/10 text-moss rounded-full px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
            {provider.status}
          </span>
          <Link
            className="button-secondary"
            href={`/p/${provider.public_slug}`}
            target="_blank"
          >
            Ver perfil público ↗
          </Link>
        </div>
      </div>

      <div className="mt-10">
        <MarketplaceManagement
          provider={provider}
          skills={marketplaceSkills}
          providerSkills={providerSkills ?? []}
          services={services ?? []}
          experiences={experiences ?? []}
          education={education ?? []}
          certifications={certifications ?? []}
          portfolioItems={portfolioItems ?? []}
          serviceAreas={serviceAreas ?? []}
          availabilityRules={availabilityRules ?? []}
          availabilityBlocks={availabilityBlocks ?? []}
          actions={{
            settings: updateMarketplaceSettings,
            saveSkill: saveProviderSkill,
            removeSkill: removeProviderSkill,
            saveService,
            pauseService: toggleServicePause,
            deleteService,
            saveExperience,
            deleteExperience,
            saveEducation,
            deleteEducation,
            saveCertification,
            deleteCertification,
            savePortfolio: savePortfolioItem,
            deletePortfolio: deletePortfolioItem,
            saveArea: saveServiceArea,
            deleteArea: deleteServiceArea,
            saveRule: saveAvailabilityRule,
            deleteRule: deleteAvailabilityRule,
            saveBlock: saveAvailabilityBlock,
            deleteBlock: deleteAvailabilityBlock,
          }}
        />
      </div>
    </section>
  );
}
