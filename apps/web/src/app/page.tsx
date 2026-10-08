import { HeroVisual } from "@/components/ui/marketplace/hero-visual";
import { HowItWorks } from "@/components/ui/marketplace/how-it-works";
import { SiteFooter } from "@/components/ui/site-footer";
import Link from "next/link";
import { DesktopNav } from "@/components/ui/marketplace/desktop-nav";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { ExampleServices } from "@/components/discovery/example-services";
import { BottomNav } from "@/components/ui/nav-with-counts";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { CategoryTile } from "@/components/ui/marketplace/category-tile";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { NearbyServiceRail } from "@/components/ui/marketplace/nearby-service-rail";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Encontrá a alguien que lo haga",
  description:
    "Buscá servicios y personas con habilidades cerca tuyo o trabajá de forma remota.",
};

export const dynamic = "force-dynamic";

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

  return (
    <main
      id="main-content"
      className="feed-home bg-canvas text-ink mobile-content-with-nav min-h-screen"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8 sm:pt-5">
        <header className="consumer-app-header bg-canvas/90 border-ink/[0.06] sticky top-0 z-30 -mx-4 flex min-h-14 items-center justify-between border-b px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
          <Link
            className="flex min-w-0 items-center gap-2.5"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark h-9 w-9" aria-hidden="true">
              C
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] leading-5 font-extrabold tracking-[-0.02em]">
                {user ? `Hola, ${accountName}` : "Changas"}
              </span>
              <span className="text-ink/70 block truncate text-[13px] leading-4 font-medium">
                {user ? "¿Qué resolvemos hoy?" : "Servicios cerca tuyo"}
              </span>
            </span>
          </Link>
          <div className="mr-2 ml-auto hidden sm:block">
            <DesktopNav authenticated={Boolean(user)} />
          </div>
          {user ? (
            <Link
              href="/account"
              className="consumer-pressable hover:bg-ink/[0.04] flex h-12 w-12 items-center justify-center rounded-full sm:hidden"
              aria-label="Abrir mi cuenta"
            >
              <Avatar name={accountName} size="sm" />
            </Link>
          ) : (
            <Link
              className="consumer-pressable hover:bg-ink/[0.04] text-ink border-ink/[0.1] bg-surface inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold shadow-sm"
              href="/login"
            >
              Ingresar
            </Link>
          )}
        </header>

        <div className="pt-4 sm:pt-9">
          <section
            aria-labelledby="home-search-title"
            className="brand-gradient-surface text-ink relative overflow-hidden rounded-[1.75rem] p-5 shadow-[var(--consumer-shadow-hero)] sm:p-9"
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "12px 12px",
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/20"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/15"
              aria-hidden="true"
            />
            <div className="relative z-10 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-10">
              <div>
                <div className="relative z-10 max-w-2xl">
                  <p className="text-ink/80 text-xs font-extrabold tracking-[0.14em] uppercase">
                    Tu mercado de tareas rápidas
                  </p>
                  <h1
                    id="home-search-title"
                    className="mt-3 max-w-xl text-[2.5rem] leading-none font-extrabold tracking-[-0.04em] sm:text-6xl"
                  >
                    Encontrá a alguien que lo haga.
                  </h1>
                  <p className="text-ink/80 mt-3 max-w-lg text-[15px] leading-6 sm:text-lg">
                    Oficios verificables cerca tuyo o por videollamada. Buscá
                    una vez y elegí con precios claros.
                  </p>
                </div>
                <form
                  action="/buscar"
                  className="relative z-10 mt-6 flex flex-col gap-2.5 sm:max-w-2xl sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <SearchField
                      className="min-h-14 shadow-[var(--shadow-lg)]"
                      id="home-query"
                      name="q"
                      placeholder="Plomero, clases, paseo…"
                      aria-label="Buscar un servicio o habilidad"
                    />
                  </div>
                  <button
                    className="consumer-pressable cta-ink inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-8 text-[15px] font-extrabold whitespace-nowrap sm:w-auto"
                    type="submit"
                  >
                    Buscar
                  </button>
                </form>
                <div
                  className="relative z-10 mt-4 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Atajos de búsqueda"
                >
                  <Link
                    href="/buscar?mode=presencial"
                    className="chip-glass consumer-pressable inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold"
                  >
                    Presencial
                  </Link>
                  <Link
                    href="/buscar?mode=remoto"
                    className="chip-glass consumer-pressable inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold"
                  >
                    Remoto
                  </Link>
                  <Link
                    href="/buscar?offers=true"
                    className="chip-glass consumer-pressable inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold"
                  >
                    Acepta ofertas
                  </Link>
                </div>
              </div>
              <HeroVisual />
            </div>
          </section>

          <section className="mt-6" aria-labelledby="categories-title">
            <div id="categories-title">
              <SectionHeader
                title="Oficios populares"
                actionHref="/buscar"
                actionLabel="Ver todos"
                badge={{ tone: "gold", icon: "compass" }}
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2.5 sm:grid-cols-7">
              {(categories ?? []).map((category) => (
                <CategoryTile
                  key={category.slug}
                  href={`/categoria/${category.slug}`}
                  label={category.name}
                  description={category.description}
                  icon={category.slug}
                />
              ))}
            </div>
          </section>

          <section className="mt-7">
            {discovery.error ? (
              <div>
                <SectionHeader
                  title="Profesionales destacados"
                  actionHref="/buscar"
                  actionLabel="Explorar más"
                  badge={{ tone: "orange", icon: "star" }}
                />
                <p className="text-ink/70 mt-3 text-sm" role="status">
                  La búsqueda está momentáneamente en mantenimiento.
                </p>
              </div>
            ) : discovery.rows.length > 0 ? (
              <NearbyServiceRail
                rows={discovery.rows.slice(0, 6)}
                title="Profesionales destacados"
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
          </section>

          <HowItWorks />

          <section className="consumer-card bg-surface relative mt-6 flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_48%,#FF0A78_100%)]"
              aria-hidden="true"
            />
            <div className="flex items-start gap-3">
              <IllustratedBadge tone="green" icon="shield" size="md" label="Identidad verificada" />
              <div>
                <h2 className="text-[15px] font-extrabold">
                  Elegí con confianza
                </h2>
                <p className="text-ink/70 mt-1 text-[13px] leading-5">
                  Cada proveedor verifica su identidad (DNI y selfie) antes de
                  publicar. Perfiles públicos, precios claros y reseñas de
                  trabajos reales. La verificación confirma quién es la persona;
                  no certifica matrículas ni la calidad del trabajo.
                </p>
              </div>
            </div>
          </section>

          {!user ? (
            <section className="consumer-card bg-ink! relative mt-4 flex flex-col gap-3 overflow-hidden p-5 text-white dark:border-white/10 dark:bg-[#2a231c]! dark:text-[#f5efe8]">
              <span
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                  backgroundSize: "12px 12px",
                }}
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute -right-8 -bottom-12 h-36 w-36 rounded-full bg-white/10"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                  Tu oficio merece un buen escaparate.
                </h2>
                <p className="mt-1 text-[13px] text-white/70">
                  Publicá lo que hacés y empezá a recibir consultas.
                </p>
              </div>
              <Link
                className="consumer-pressable text-ink inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold dark:border dark:border-white/15 dark:bg-white/10 dark:text-white"
                href="/provider/onboarding"
              >
                Ofrecer mis servicios
              </Link>
            </section>
          ) : null}
          <SiteFooter />
        </div>
      </div>
      <BottomNav authenticated={Boolean(user)} />
    </main>
  );
}
