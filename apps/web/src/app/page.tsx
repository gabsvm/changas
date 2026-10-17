import Image from "next/image";
import Link from "next/link";
import "./yalo-showcase.css";
import "./yalo-category-photography.css";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";
import { ExampleServices } from "@/components/discovery/example-services";
import { BottomNav } from "@/components/ui/nav-with-counts";
import { DesktopNav } from "@/components/ui/marketplace/desktop-nav";
import { CategoryTile } from "@/components/ui/marketplace/category-tile";
import { HowItWorks } from "@/components/ui/marketplace/how-it-works";
import { MagneticRibbons } from "@/components/ui/marketplace/magnetic-ribbons";
import { NearbyServiceRail } from "@/components/ui/marketplace/nearby-service-rail";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { SiteFooter } from "@/components/ui/site-footer";
import { searchDiscovery } from "@/lib/discovery/server";
import { listMyUpcomingJobs, type UpcomingJob } from "@/lib/jobs/server";
import {
  JOB_TERMINAL_STATUSES,
  getJobStatusPresentation,
} from "@/lib/ui/job-status";
import { getJobTracking } from "@/components/jobs/job-tracking";
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

export default async function HomePage() {
  const filters = parseDiscoveryFilters({ pageSize: "6" });
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: categories },
    discovery,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("categories")
      .select("slug, name, description")
      .eq("is_active", true)
      .order("sort_order")
      .limit(8),
    searchDiscovery({ query: "", filters }),
  ]);

  const { data: greetingProfile } = user
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const accountName =
    greetingProfile?.display_name?.trim().split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "Tu cuenta";

  let activeJobs: UpcomingJob[] = [];
  if (user) {
    try {
      activeJobs = (await listMyUpcomingJobs(5)).filter(
        (job) => !JOB_TERMINAL_STATUSES.includes(job.job_status),
      );
    } catch {
      activeJobs = [];
    }
  }

  const heroJob = activeJobs[0] ?? null;
  const heroTracking = heroJob
    ? getJobTracking(heroJob.job_status, null)
    : null;
  const heroStatus = heroJob
    ? getJobStatusPresentation(heroJob.job_status)
    : null;

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
                height={35}
                alt=""
                priority
              />
            </span>
            <span className="yalo-header-wordmark">YALO</span>
          </Link>
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
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18 18 6M8 6h10v10" />
                </svg>
              </span>
            </Link>
          </div>
          <Link className="yalo-nav-mobile" href={user ? "/account" : "/login"}>
            {user ? "Mi cuenta" : "Ingresar"}{" "}
            <span aria-hidden="true">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M8 6h10v10" />
              </svg>
            </span>
          </Link>
        </header>

        {heroJob && heroTracking && heroStatus ? (
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
              Ver seguimiento{" "}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M8 6h10v10" />
              </svg>
            </span>
          </Link>
        ) : null}

        <section className="yalo-stage" aria-labelledby="home-search-title">
          <div className="yalo-stage-backdrop" aria-hidden="true">
            <span className="yalo-stage-orb yalo-stage-orb-one" />
            <span className="yalo-stage-orb yalo-stage-orb-two" />
          </div>
          <MagneticRibbons />
          <div className="yalo-stage-copy">
            <div className="yalo-hero-eyebrow">
              <span className="yalo-eyebrow-spark" aria-hidden="true" />
              TRABAJÁ · CONTRATÁ · CRECÉ
              <span className="yalo-eyebrow-arrow" aria-hidden="true">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18 18 6M8 6h10v10" />
                </svg>
              </span>
            </div>
            <h1 id="home-search-title" className="yalo-stage-title">
              Lo que necesitás.
              <span>Alguien que sabe hacerlo.</span>
            </h1>
            <p className="yalo-stage-description">
              ¿Necesitás resolver algo o querés ofrecer lo que sabés hacer?
              Elegí cómo empezar.
            </p>

            <nav
              className="yalo-intent"
              aria-label="Elegí qué querés hacer en YALO"
            >
              <div className="yalo-intent-actions">
                <Link
                  href="/buscar"
                  className="yalo-intent-link yalo-intent-hire"
                >
                  <span className="yalo-intent-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="23" height="23" fill="none">
                      <circle
                        cx="10.7"
                        cy="10.7"
                        r="6.3"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="m15.5 15.5 4.6 4.6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="yalo-intent-text">
                    <strong>Quiero contratar</strong>
                    <span>Encontrar alguien que me ayude</span>
                  </span>
                  <span className="yalo-intent-arrow" aria-hidden="true">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 18 18 6M8 6h10v10" />
                    </svg>
                  </span>
                </Link>
                <Link
                  href="/provider/onboarding"
                  className="yalo-intent-link yalo-intent-work"
                >
                  <span className="yalo-intent-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="23" height="23" fill="none">
                      <rect
                        x="3"
                        y="7"
                        width="18"
                        height="13"
                        rx="2.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M9 7V5.5C9 4.7 9.7 4 10.5 4h3c.8 0 1.5.7 1.5 1.5V7M3 12.5c5.4 3.6 12.6 3.6 18 0"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="yalo-intent-text">
                    <strong>Quiero trabajar</strong>
                    <span>Ofrecer mis servicios</span>
                  </span>
                  <span className="yalo-intent-arrow" aria-hidden="true">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 18 18 6M8 6h10v10" />
                    </svg>
                  </span>
                </Link>
              </div>
            </nav>

            <p className="yalo-hero-search-caption">
              ¿Ya sabés qué necesitás? Buscá directamente
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
                Buscar{" "}
                <span aria-hidden="true">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M8 6h10v10" />
                  </svg>
                </span>
              </button>
            </form>

            <div
              className="yalo-hero-shortcuts"
              role="group"
              aria-label="Explorar servicios"
            >
              <span>Explorá por</span>
              <Link href="/buscar?mode=presencial">
                Presencial{" "}
                <span aria-hidden="true">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M8 6h10v10" />
                  </svg>
                </span>
              </Link>
              <Link href="/buscar?mode=remoto">
                Remoto{" "}
                <span aria-hidden="true">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M8 6h10v10" />
                  </svg>
                </span>
              </Link>
              <Link href="/buscar?offers=true">
                Con ofertas{" "}
                <span aria-hidden="true">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M8 6h10v10" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          <div className="yalo-stage-footnote" aria-hidden="true">
            <span>PERSONAS + HABILIDADES + OPORTUNIDADES</span>
            <span className="yalo-stage-scroll">
              DESCUBRÍ YALO <span>↓</span>
            </span>
          </div>
        </section>

        <section
          className="yalo-confidence-bar"
          aria-label="Por qué elegir YALO"
        >
          <span>
            <span className="yalo-confidence-icon">✓</span> Perfiles con
            identidad verificada
          </span>
          <span>
            <span className="yalo-confidence-icon">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M8 6h10v10" />
              </svg>
            </span>{" "}
            Conversá sin intermediarios
          </span>
          <span>
            <span className="yalo-confidence-icon">✦</span> Reseñas de trabajos
            reales
          </span>
        </section>

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
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18 18 6M8 6h10v10" />
                </svg>
              </span>
            </Link>
          </div>
          <div className="yalo-category-grid">
            {(categories ?? [])
              .filter(
                (category) =>
                  process.env.NODE_ENV !== "production" ||
                  (category.slug !== "prueba-emulador" &&
                    !/prueba emulador/i.test(category.name)),
              )
              .map((category) => (
                <CategoryTile
                  key={category.slug}
                  href={"/categoria/" + category.slug}
                  label={category.name}
                  description={category.description}
                  icon={category.slug}
                />
              ))}
            {!categories || categories.length === 0 ? (
              <p className="yalo-empty-copy">
                Explorá los servicios disponibles en YALO.
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
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18 18 6M8 6h10v10" />
                </svg>
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
                La búsqueda está momentáneamente en mantenimiento. Probá de
                nuevo más tarde.
              </p>
            ) : discovery.rows.length > 0 ? (
              <NearbyServiceRail
                rows={discovery.rows.slice(0, 6)}
                title="Servicios disponibles"
                actionHref="/buscar"
              />
            ) : (
              <ExampleServices
                publishHref={
                  user
                    ? "/provider/onboarding"
                    : "/login?next=/provider/onboarding"
                }
              />
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
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 18 18 6M8 6h10v10" />
                    </svg>
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
        <BottomNav authenticated={Boolean(user)} />
      </div>
    </main>
  );
}
