import Link from "next/link";
import { redirect } from "next/navigation";

import { ProviderPaymentAccount } from "@/components/payments/provider-payment-account";
import { MarketplaceManagement } from "@/components/provider/marketplace-management";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { getProviderPaymentAccountState } from "@/lib/payments/server";
import { createClient } from "@/lib/supabase/server";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

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
  saveServiceArea,
  toggleServicePause,
  updateMarketplaceSettings,
} from "../../marketplace-actions";
import { saveServiceTransactional } from "../../service-actions";

export const dynamic = "force-dynamic";

type ProviderManagePageProps = {
  searchParams?: Promise<{
    payment_account?: string | string[];
  }>;
};

export default async function ProviderMarketplaceManagePage({
  searchParams = Promise.resolve({}),
}: ProviderManagePageProps = {}) {
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
    { data: serviceTags },
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
    supabase.from("service_tags").select("service_id, tag"),
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
      <section className="pb-6 sm:py-14">
        <MobileAppBar title="Gestionar servicios" backHref="/account" />
        <EmptyState
          title="Primero prepará tu perfil"
          description="Creá tu espacio de proveedor antes de administrar habilidades y servicios."
          actionHref="/provider/onboarding"
          actionLabel="Ir a verificación"
          className="pt-16"
        />
      </section>
    );
  }

  const [paymentAccount, resolvedSearchParams] = await Promise.all([
    getProviderPaymentAccountState(),
    searchParams,
  ]);
  const paymentParam = resolvedSearchParams.payment_account;
  const paymentFeedback =
    paymentParam === "connected" || paymentParam === "oauth_error"
      ? paymentParam
      : null;

  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );
  const marketplaceSkills = (skills ?? []).map((skill) => ({
    ...skill,
    category_name: categoryNames.get(skill.category_id) ?? "Catálogo",
  }));
  const selectedSkillIds = new Set(
    (providerSkills ?? []).map((providerSkill) => providerSkill.skill_id),
  );
  const selectedSkills = marketplaceSkills.filter((skill) =>
    selectedSkillIds.has(skill.id),
  );
  const serviceTagsByServiceId: Record<string, string[]> = {};
  for (const serviceTag of serviceTags ?? []) {
    const tags = serviceTagsByServiceId[serviceTag.service_id] ?? [];
    serviceTagsByServiceId[serviceTag.service_id] = [...tags, serviceTag.tag];
  }
  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "proveedor";
  const status = getProviderStatusPresentation(provider.status);

  return (
    <section className="pb-8 sm:py-14">
      <MobileAppBar title="Gestionar servicios" backHref="/account" />
      <div className="pt-5 sm:pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
              Proveedor
            </p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
              Gestioná tu oferta
            </h1>
            <p className="text-ink/55 mt-1 text-sm">
              {displayName} · habilidades, servicios y disponibilidad
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <Link
              className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold hover:bg-brand-orange/[0.06]"
              href={`/p/${provider.public_slug}`}
              target="_blank"
            >
              Ver perfil público ↗
            </Link>
          </div>
        </div>

        <div className="border-ink/10 mt-6 border-t pt-5">
          <ProviderPaymentAccount
            account={paymentAccount}
            feedback={paymentFeedback}
          />
        </div>

        <div className="mt-6">
          <MarketplaceManagement
            provider={provider}
            catalogSkills={marketplaceSkills}
            skills={selectedSkills}
            providerSkills={providerSkills ?? []}
            services={services ?? []}
            serviceTagsByServiceId={serviceTagsByServiceId}
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
              saveService: saveServiceTransactional,
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
      </div>
    </section>
  );
}
