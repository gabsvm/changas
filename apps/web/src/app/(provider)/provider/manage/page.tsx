import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMinorUnits } from "@changas/domain";

import { MarketplaceManagement } from "@/components/provider/marketplace-management";
import { ProviderPaymentAccount } from "@/components/payments/provider-payment-account";
import type { SkillRequestSummary } from "@/components/provider/skill-request-section";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { listMyPastJobs, listMyUpcomingJobs } from "@/lib/jobs/server";
import {
  getProviderPaymentAccountState,
  type ProviderPaymentAccountState,
} from "@/lib/payments/server";
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
    providerResult,
    profileResult,
    skillsResult,
    categoriesResult,
    providerSkillsResult,
    servicesResult,
    skillRequestsResult,
    serviceTagsResult,
    experiencesResult,
    educationResult,
    certificationsResult,
    portfolioItemsResult,
    serviceAreasResult,
    availabilityRulesResult,
    availabilityBlocksResult,
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
      .from("skill_requests")
      .select("id, name, status, created_at")
      .eq("requester_user_id", user.id)
      .order("created_at", { ascending: false }),
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

  const provider = providerResult.data;
  const profile = profileResult.data;
  const skills = skillsResult.data;
  const categories = categoriesResult.data;
  const providerSkills = providerSkillsResult.data;
  const services = servicesResult.data;
  const serviceTags = serviceTagsResult.data;
  const skillRequests = skillRequestsResult.data ?? [];
  const experiences = experiencesResult.data;
  const education = educationResult.data;
  const certifications = certificationsResult.data;
  const portfolioItems = portfolioItemsResult.data;
  const serviceAreas = serviceAreasResult.data;
  const availabilityRules = availabilityRulesResult.data;
  const availabilityBlocks = availabilityBlocksResult.data;

  const loadFailed = [
    providerResult,
    skillsResult,
    categoriesResult,
    providerSkillsResult,
    servicesResult,
    serviceTagsResult,
    experiencesResult,
    educationResult,
    certificationsResult,
    portfolioItemsResult,
    serviceAreasResult,
    availabilityRulesResult,
    availabilityBlocksResult,
  ].some((result) => result.error);

  if (providerResult.error) {
    return (
      <section className="pb-6 sm:py-14">
        <MobileAppBar title="Gestionar servicios" backHref="/account" />
        <EmptyState
          tone="rose"
          title="No pudimos cargar tu perfil"
          description="Hubo un problema al leer tus datos. Recargá la página en unos segundos."
          actionHref="/provider/manage"
          actionLabel="Reintentar"
          className="pt-16"
        />
      </section>
    );
  }

  if (!provider) {
    return (
      <section className="pb-6 sm:py-14">
        <MobileAppBar title="Gestionar servicios" backHref="/account" />
        <EmptyState
          tone="blue"
          title="Primero prepará tu perfil"
          description="Creá tu espacio de proveedor antes de administrar habilidades y servicios."
          actionHref="/provider/onboarding"
          actionLabel="Ir a verificación"
          className="pt-16"
        />
      </section>
    );
  }

  // A payments failure must not take down the whole management page.
  const [paymentAccount, resolvedSearchParams] = await Promise.all([
    getProviderPaymentAccountState().catch((): ProviderPaymentAccountState => ({
      providerName: "MERCADO_PAGO",
      providerAccountReference: null,
      status: "DISCONNECTED",
      tokenExpiresAt: null,
      updatedAt: null,
    })),
    searchParams,
  ]);
  const paymentParam = resolvedSearchParams.payment_account;
  const paymentFeedback =
    paymentParam === "connected" || paymentParam === "oauth_error"
      ? paymentParam
      : null;

  // Resumen de ingresos, solo lectura: reutiliza los listados de trabajos
  // existentes. Una falla acá no voltea la página.
  const income = await Promise.all([
    listMyPastJobs(50).catch(() => []),
    listMyUpcomingJobs(50).catch(() => []),
  ]).then(([past, upcoming]) => {
    const mine = [...past, ...upcoming].filter(
      (job) => job.is_client === false,
    );
    const settled = mine.filter((job) => job.settlement_status === "SETTLED");
    const due = mine.filter((job) => job.settlement_status === "DUE");
    const inProgress = mine.filter((job) =>
      ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
        job.job_status,
      ),
    );
    return {
      settledCount: settled.length,
      settledTotal: settled.reduce(
        (sum, job) => sum + (job.settlement_total_minor ?? 0),
        0,
      ),
      dueCount: due.length,
      dueTotal: due.reduce(
        (sum, job) => sum + (job.settlement_total_minor ?? 0),
        0,
      ),
      inProgressCount: inProgress.length,
    };
  });

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
  const suggestedSlug = displayName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const status = getProviderStatusPresentation(provider.status);

  return (
    <section className="pb-8 sm:py-14">
      <MobileAppBar title="Gestionar servicios" backHref="/account" />
      <div className="pt-5 sm:pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IllustratedBadge
              tone="orange"
              icon="briefcase"
              size="md"
              label="Proveedor"
            />
            <div className="min-w-0">
              <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
                Proveedor
              </p>
              <h1 className="font-display mt-0.5 text-3xl font-extrabold tracking-[-0.035em]">
                Gestioná tu oferta
              </h1>
              <p className="text-ink/70 mt-1 text-sm">
                {displayName} · habilidades, servicios y disponibilidad
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <Link
              className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.06] inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
              href={`/p/${provider.public_slug}`}
              target="_blank"
            >
              Ver perfil público ↗
            </Link>
          </div>
        </div>
        <div
          className="border-ink/10 bg-surface mt-6 rounded-2xl border p-5"
          aria-label="Resumen de ingresos"
        >
          <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
            Resumen de ingresos
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[22px] leading-7 font-extrabold">
                {formatMinorUnits(income.settledTotal, "ARS")}
              </p>
              <p className="text-ink/70 mt-0.5 text-[13px]">
                Cobrado · {income.settledCount}{" "}
                {income.settledCount === 1 ? "trabajo" : "trabajos"}
              </p>
            </div>
            <div>
              <p className="text-[22px] leading-7 font-extrabold">
                {formatMinorUnits(income.dueTotal, "ARS")}
              </p>
              <p className="text-ink/70 mt-0.5 text-[13px]">
                Pendiente de cobro · {income.dueCount}{" "}
                {income.dueCount === 1 ? "trabajo" : "trabajos"}
              </p>
            </div>
            <div>
              <p className="text-[22px] leading-7 font-extrabold">
                {income.inProgressCount}
              </p>
              <p className="text-ink/70 mt-0.5 text-[13px]">En curso</p>
            </div>
          </div>
          <p className="text-ink/60 mt-3 text-xs leading-5">
            Se calcula desde tus trabajos como prestador (hasta 50 por listado).
            El detalle está en{" "}
            <Link
              href="/jobs?status=history"
              className="font-bold underline underline-offset-4"
            >
              Mis trabajos
            </Link>
            .
          </p>
        </div>

        {loadFailed ? (
          <p
            className="bg-terracotta/10 text-terracotta mt-5 rounded-xl px-4 py-3 text-sm"
            role="alert"
          >
            No pudimos cargar algunas secciones. Lo que ves puede estar
            incompleto: recargá antes de editar.
          </p>
        ) : null}

        <div className="border-ink/10 mt-6 border-t pt-5">
          <ProviderPaymentAccount
            account={paymentAccount}
            feedback={paymentFeedback}
          />
        </div>

        <div
          className="mt-6 h-px bg-gradient-to-r from-transparent via-[#EE5A24]/40 to-transparent"
          role="separator"
          aria-orientation="horizontal"
        />

        <div className="mt-6">
          <MarketplaceManagement
            provider={provider}
            suggestedSlug={
              suggestedSlug.length >= 3 ? suggestedSlug : undefined
            }
            catalogSkills={marketplaceSkills}
            skills={selectedSkills}
            providerSkills={providerSkills ?? []}
            services={services ?? []}
            skillRequestCategories={(categories ?? []).map((category) => ({
              id: category.id,
              name: category.name,
            }))}
            skillRequests={skillRequests.map((request) => ({
              id: request.id,
              name: request.name,
              status: request.status as SkillRequestSummary["status"],
              created_at: request.created_at,
            }))}
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
