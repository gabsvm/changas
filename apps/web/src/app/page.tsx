import Image from "next/image";
import Link from "next/link";
import { Suspense, cache } from "react";
import "./yalo-showcase.css";
import "./yalo-category-photography.css";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";
import { ExampleServices } from "@/components/discovery/example-services";
import { BottomNav } from "@/components/ui/nav-with-counts";
import { DesktopNav } from "@/components/ui/marketplace/desktop-nav";
import { CategoryTile } from "@/components/ui/marketplace/category-tile";
import { ActionArrowIcon } from "@/components/ui/marketplace/action-arrow-icon";
import { HowItWorks } from "@/components/ui/marketplace/how-it-works";
import { MagneticRibbons } from "@/components/ui/marketplace/magnetic-ribbons";
import { NearbyServiceRail } from "@/components/ui/marketplace/nearby-service-rail";
import { TrustStrip } from "@/components/ui/marketplace/trust-strip";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { SiteFooter } from "@/components/ui/site-footer";
import { isExcludedPublicTestCategory } from "@/lib/public-catalog";
import { listMyUpcomingJobs, type UpcomingJob } from "@/lib/jobs/server";
import {
  JOB_TERMINAL_STATUSES,
  getJobStatusPresentation,
} from "@/lib/ui/job-status";
import { getJobTracking } from "@/components/jobs/job-tracking";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Encontrá a alguien que lo haga",
  description:
    "YALO conecta a quienes necesitan resolver algo con personas que saben hacerlo. Explorá servicios, compará propuestas y contratá con confianza.",
};

export const dynamic = "force-dynamic";

const benefits = [
  {
    number: "01",
    title: "Personas reales",
    body: "Perfiles con identidad verificada antes de ofrecer servicios.",
    detail: "Identidad",
  },
  {
    number: "02",
    title: "Todo más claro",
    body: "Consultá, conversá y acordá el alcance y el precio.",
    detail: "Acuerdos",
  },
  {
    number: "03",
    title: "De principio a fin",
    body: "Seguimiento del trabajo y reseñas de experiencias reales.",
    detail: "Confianza",
  },
] as const;

// Todo lo que depende de la sesión vive en componentes async detrás de
// <Suspense>: el catálogo público (categorías + discovery) no espera a
// getUser / perfil / trabajos. cache() deduplica getUser entre ellos.
const getHomeUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

async function HomeNavigation() {
  const user = await getHomeUser();
  let accountName = "Tu cuenta";
  if (user) {
    const supabase = await createClient();
    const { data: greetingProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    accountName =
      greetingProfile?.display_name?.trim().split(/\s+/)[0] ||
      user.email?.split("@")[0] ||
      "Tu cuenta";
  }

  return (
    <>
      <div className="yalo-desktop-navigation">
        <DesktopNav authenticated={Boolean(user)} />
      </div>
      <div className="yalo-nav-actions">
        {user ? (
          <Link className="yalo-nav-login" href="/account">
            Hola, {accountName}
          </Link>
        ) : (
          <Link className="yalo-nav-login" href="/login">
            Ingresar
          </Link>
        )}
        <Link
          className="yalo-nav-primary"
          href={user ? "/provider/manage" : "/provider/onboarding"}
        >
          Ofrecer mis servicios{" "}
          <span aria-hidden="true">
            <ActionArrowIcon />
          </span>
        </Link>
      </div>
      <Link className="yalo-nav-mobile" href={user ? "/account" : "/login"}>
        {user ? "Mi cuenta" : "Ingresar"}{" "}
        <span aria-hidden="true">
          <ActionArrowIcon />
        </span>
      </Link>
    </>
  );
}

function HomeNavigationSkeleton() {
  return (
    <>
      <div className="yalo-desktop-navigation" aria-hidden="true">
        <span className="h-9 w-64 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="yalo-nav-actions" aria-hidden="true">
        <span className="h-12 w-56 animate-pulse rounded-full bg-white/10" />
      </div>
      <span
        className="yalo-nav-mobile min-w-28 animate-pulse bg-white/10! bg-none!"
        aria-hidden="true"
      />
    </>
  );
}

async function HomeLiveJob() {
  const user = await getHomeUser();
  if (!user) return null;

  let activeJobs: UpcomingJob[] = [];
  try {
    activeJobs = (await listMyUpcomingJobs(5)).filter(
      (job) => !JOB_TERMINAL_STATUSES.includes(job.job_status),
    );
  } catch {
    activeJobs = [];
  }

  const heroJob = activeJobs[0] ?? null;
  if (!heroJob) return null;
  const heroTracking = getJobTracking(heroJob.job_status, null);
  const heroStatus = getJobStatusPresentation(heroJob.job_status);
  if (!heroTracking || !heroStatus) return null;

  return (
    <Link
      href={"/jobs/" + heroJob.job_id}
      className="yalo-live-job"
      aria-label={
        "Servicio en marcha: " +
        heroJob.service_title +
        ". Ver seguimiento."
      }
    >
      <span className="yalo-live-pulse" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>
          {activeJobs.length > 1
            ? "Tenés " + activeJobs.length + " servicios en marcha"
            : "Tenés un servicio en marcha"}
        </strong>
        <small>
          {heroJob.service_title} · {heroStatus.label}
        </small>
      </span>
      <span className="yalo-live-link">
        Ver seguimiento <ActionArrowIcon />
      </span>
    </Link>
  );
}

async function HomeExampleServices() {
  const user = await getHomeUser();
  return (
    <ExampleServices
      publishHref={
        user ? "/provider/onboarding" : "/login?next=/provider/onboarding"
      }
    />
  );
}

async function HomeBottomNav() {
  const user = await getHomeUser();
  return <BottomNav authenticated={Boolean(user)} />;
}

export default async function HomePage() {
  const filters = parseDiscoveryFilters({ pageSize: "6" });
  const supabase = await createClient();
  const [{ data: categories, error: categoriesError }, discovery] =
    await Promise.all([
      supabase
        .from("categories")
        .select("slug, name, description")
        .eq("is_active", true)
        .order("sort_order"),
      searchDiscovery({ query: "", filters }),
    ]);

  const visibleCategories = (categories ?? [])
    .filter((category) => !isExcludedPublicTestCategory(category))
    .slice(0, 8);

  return (
    <main id="main-content" className="yalo-showcase mobile-content-with-nav">
      <div className="yalo-shell">
        <header className="yalo-glass-nav">
          <Link
            href="/"
            className="yalo-header-brand"
            aria-label="YALO, inicio"
          >
            <span className="yalo-header-symbol">
              <Image
                src="/brand/yalo-symbol.svg"
                width={35}
                height={28}
                alt=""
                priority
              />
            </span>
            <span
              className="brand-wordmark yalo-header-wordmark"
              aria-hidden="true"
            />
          </Link>
          <Suspense fallback={<HomeNavigationSkeleton />}>
            <HomeNavigation />
          </Suspense>
        </header>

        <Suspense fallback={null}>
          <HomeLiveJob />
        </Suspense>

        <section className="yalo-stage" aria-labelledby="home-search-title">
          <div className="yalo-stage-backdrop" aria-hidden="true">
            <span className="yalo-stage-orb yalo-stage-orb-one" />
            <span className="yalo-stage-orb yalo-stage-orb-two" />
          </div>
          <MagneticRibbons />
          <div className="yalo-stage-copy">
            <div className="yalo-hero-eyebrow">
              <span className="yalo-eyebrow-spark" aria-hidden="true" />
              CONTRATÁ CON CONFIANZA
              <span className="yalo-eyebrow-arrow" aria-hidden="true">
                ✦
              </span>
            </div>
            <h1 id="home-search-title" className="yalo-stage-title">
              Lo que necesitás.
              <span>Alguien verificado que lo haga.</span>
            </h1>
            <p className="yalo-stage-description">
              Contratá por chat, acordá el precio y calificá al final. Sin
              vueltas.
            </p>

            <form
              action="/buscar"
              role="search"
              className="yalo-hero-search"
              aria-label="Buscar servicios"
            >
              <SearchField
                id="home-query"
                name="q"
                placeholder="¿Qué necesitás resolver hoy?"
                aria-label="Buscar un servicio o habilidad"
              />
              <button className="yalo-search-submit" type="submit">
                Buscar servicios{" "}
                <span aria-hidden="true">
                  <ActionArrowIcon />
                </span>
              </button>
            </form>

            <p className="yalo-hero-offer">
              ¿Sos profesional?{" "}
              <Link href="/provider/onboarding">
                Ofrecer mis servicios{" "}
                <span aria-hidden="true">
                  <ActionArrowIcon />
                </span>
              </Link>
            </p>

            <div
              className="yalo-hero-shortcuts"
              role="group"
              aria-label="Explorar servicios"
            >
              <span>Explorá por</span>
              <Link href="/buscar?mode=presencial">
                Presencial{" "}
                <span aria-hidden="true">
                  <ActionArrowIcon />
                </span>
              </Link>
              <Link href="/buscar?mode=remoto">
                Remoto{" "}
                <span aria-hidden="true">
                  <ActionArrowIcon />
                </span>
              </Link>
              <Link href="/buscar?offers=true">
                Con ofertas{" "}
                <span aria-hidden="true">
                  <ActionArrowIcon />
                </span>
              </Link>
            </div>
            {arePublicNeedsEnabled() ? (
              <p className="yalo-hero-offer">
                ¿No encontrás lo que buscás?{" "}
                <Link href="/needs/new">
                  Publicá una necesidad{" "}
                  <span aria-hidden="true">
                    <ActionArrowIcon />
                  </span>
                </Link>
              </p>
            ) : null}
          </div>

          <div className="yalo-stage-footnote" aria-hidden="true">
            <span>PERSONAS + HABILIDADES + OPORTUNIDADES</span>
            <span className="yalo-stage-scroll">
              DESCUBRÍ YALO <span>↓</span>
            </span>
          </div>
        </section>

        <TrustStrip
          items={[
            { label: "Identidad verificada" },
            { label: "Precio acordado por chat" },
            { label: "Reseñas de trabajos reales" },
          ]}
        />

        <section
          className="yalo-home-section yalo-category-section"
          aria-labelledby="categories-title"
        >
          <div className="yalo-section-heading">
            <div>
              <p className="yalo-section-kicker">ENCONTRÁ TU SOLUCIÓN</p>
              <h2 id="categories-title">
                ¿Qué hacemos hoy<span className="yalo-period">?</span>
              </h2>
              <p className="yalo-section-description">
                Desde algo puntual hasta ese proyecto que venís postergando.
              </p>
            </div>
            <Link href="/buscar" className="yalo-section-link">
              Ver todos los servicios{" "}
              <span aria-hidden="true">
                <ActionArrowIcon />
              </span>
            </Link>
          </div>
          <div className="yalo-category-grid">
            {visibleCategories.map((category) => (
              <CategoryTile
                key={category.slug}
                href={"/categoria/" + category.slug}
                label={category.name}
                description={category.description}
                icon={category.slug}
              />
            ))}
            {categoriesError ? (
              <p className="yalo-empty-copy" role="status">
                No pudimos cargar las categorías.{" "}
                <Link
                  className="font-extrabold underline underline-offset-4"
                  href="/"
                >
                  Reintentar
                </Link>
              </p>
            ) : visibleCategories.length === 0 ? (
              <p className="yalo-empty-copy" role="status">
                Todavía no hay categorías para mostrar.{" "}
                <Link
                  className="font-extrabold underline underline-offset-4"
                  href="/buscar"
                >
                  Buscar servicios
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="yalo-home-section yalo-featured-section"
          aria-labelledby="featured-title"
        >
          <div className="yalo-section-heading">
            <div>
              <p className="yalo-section-kicker">PERSONAS QUE HACEN</p>
              <h2 id="featured-title">
                Talento para lo que venga<span className="yalo-period">.</span>
              </h2>
              <p className="yalo-section-description">
                Mirá perfiles, compará propuestas y elegí con información.
              </p>
            </div>
            <Link href="/buscar" className="yalo-section-link">
              Explorar YALO{" "}
              <span aria-hidden="true">
                <ActionArrowIcon />
              </span>
            </Link>
          </div>
          <div
            className={
              discovery.rows.length > 0 && discovery.rows.length <= 2
                ? "yalo-featured-results yalo-featured-results--compact"
                : "yalo-featured-results"
            }
          >
            {discovery.error ? (
              <p role="status" className="yalo-empty-copy">
                No pudimos cargar profesionales en este momento.{" "}
                <Link
                  className="font-extrabold underline underline-offset-4"
                  href="/"
                >
                  Reintentar
                </Link>
              </p>
            ) : discovery.rows.length > 0 ? (
              <NearbyServiceRail
                rows={discovery.rows.slice(0, 6)}
                title="Servicios disponibles"
                actionHref="/buscar"
              />
            ) : (
              <Suspense
                fallback={
                  <ExampleServices publishHref="/login?next=/provider/onboarding" />
                }
              >
                <HomeExampleServices />
              </Suspense>
            )}
          </div>
        </section>

        <section
          className="yalo-home-section yalo-values"
          aria-labelledby="values-title"
        >
          <div className="yalo-section-heading">
            <div>
              <p className="yalo-section-kicker">ASÍ DE SIMPLE</p>
              <h2 id="values-title">
                Un buen contacto cambia todo
                <span className="yalo-period">.</span>
              </h2>
            </div>
          </div>
          <div className="yalo-values-grid">
            {benefits.map((benefit) => (
              <article key={benefit.number} className="yalo-value-card">
                <div className="yalo-value-top">
                  <span className="yalo-value-number">{benefit.number} /</span>
                  <span className="yalo-value-glyph" aria-hidden="true">
                    ✦
                  </span>
                </div>
                <span className="yalo-value-label">{benefit.detail}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.body}</p>
              </article>
            ))}
          </div>
          <div className="yalo-how-it-works">
            <HowItWorks />
          </div>
        </section>

        <SiteFooter className="yalo-showcase-footer" />
      </div>
      <div className="yalo-mobile-bottom-nav">
        <Suspense fallback={<BottomNav authenticated={false} />}>
          <HomeBottomNav />
        </Suspense>
      </div>
    </main>
  );
}
