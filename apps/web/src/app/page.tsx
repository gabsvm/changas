import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { LocationPicker } from "@/components/discovery/location-picker";
import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { CategoryTile } from "@/components/ui/marketplace/category-tile";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { NearbyServiceRail } from "@/components/ui/marketplace/nearby-service-rail";
import { SearchField } from "@/components/ui/marketplace/search-field";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { searchDiscovery } from "@/lib/discovery/server";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Encontrá a alguien que lo haga",
  description:
    "Buscá servicios y personas con habilidades cerca tuyo o trabajá de forma remota.",
};

export const dynamic = "force-dynamic";

function categoryIcon(slug: string): string {
  if (slug.includes("hogar") || slug.includes("limpieza")) return "🧹";
  if (slug.includes("mantenimiento") || slug.includes("repar")) return "🛠️";
  if (slug.includes("mascota")) return "🐾";
  if (slug.includes("envio") || slug.includes("mudanza")) return "📦";
  if (slug.includes("tecnolog")) return "💻";
  if (slug.includes("clase") || slug.includes("educ")) return "📚";
  return "✦";
}

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
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;
  const accountName = user?.email?.split("@")[0] || "Tu cuenta";

  return (
    <main
      id="main-content"
      className={`feed-home bg-canvas text-ink min-h-screen ${user ? "mobile-content-with-nav" : ""}`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8 sm:pt-5">
        <header className="bg-canvas/96 border-ink/[0.06] sticky top-0 z-30 -mx-4 flex min-h-16 items-center justify-between border-b px-4 shadow-[0_1px_0_rgba(32,33,36,0.04)] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:px-0 sm:shadow-none sm:backdrop-blur-none">
          <Link
            className="flex min-w-0 items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark h-10 w-10" aria-hidden="true">
              C
            </span>
            <span className="min-w-0">
              <span className="brand-kicker block text-[0.62rem]">CHANGAS</span>
              <span className="block truncate text-base font-extrabold tracking-[-0.025em]">
                {user ? `Hola, ${accountName}` : "Servicios cerca tuyo"}
              </span>
            </span>
          </Link>
          {user ? (
            <Link
              href="/account"
              className="consumer-pressable hover:bg-ink/[0.035] flex min-h-11 items-center gap-2 rounded-full pr-1 pl-2"
              aria-label="Abrir mi cuenta"
            >
              <span className="text-ink/70 hidden text-sm font-semibold sm:inline">
                Mi cuenta
              </span>
              <Avatar name={accountName} size="sm" />
            </Link>
          ) : (
            <Link
              className="consumer-pressable hover:bg-ink/[0.04] text-ink/70 border-ink/[0.09] bg-surface inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-bold shadow-sm"
              href="/login"
            >
              Ingresar
            </Link>
          )}
        </header>

        <div className="pt-5 sm:pt-9">
          <div className="feed-location-summary mb-3 flex items-center gap-2 px-1 text-xs sm:mb-4 sm:px-0">
            <span
              className="bg-brand-orange/12 text-terracotta grid h-8 w-8 shrink-0 place-items-center rounded-full"
              aria-hidden="true"
            >
              ⌖
            </span>
            <div className="min-w-0">
              <p className="text-ink/45 font-bold tracking-[0.12em] uppercase">
                Descubrí cerca tuyo
              </p>
              <p className="text-ink/58 mt-0.5 truncate">
                Elegí una zona o buscá servicios remotos.
              </p>
            </div>
          </div>
          <section
            className="home-search-panel consumer-card bg-surface hidden p-3 sm:block sm:p-4"
            aria-labelledby="home-search-title"
          >
            <div className="px-1 pb-2 sm:px-2">
              <p className="brand-kicker text-xs">BUSCÁ A TU MANERA</p>
              <h1
                id="home-search-title"
                className="mt-1 text-xl font-extrabold tracking-[-0.035em] sm:text-2xl"
              >
                ¿Qué necesitás resolver hoy?
              </h1>
            </div>
            <form action="/buscar">
              <SearchField
                className="min-h-14"
                id="home-query"
                name="q"
                placeholder="¿Qué changa o servicio necesitás?"
                aria-label="Buscar un servicio o habilidad"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <LocationPicker compact />
                <button
                  className="consumer-pressable bg-brand-orange text-ink min-h-12 w-full rounded-xl px-5 text-sm font-extrabold whitespace-nowrap shadow-[0_6px_16px_rgba(255,107,53,0.22)] sm:w-auto"
                  type="submit"
                >
                  Buscar servicios <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </section>

          <section className="quick-action-card brand-gradient-surface relative mt-5 overflow-hidden rounded-[1.5rem] p-5 text-white shadow-[var(--consumer-shadow-hero)] sm:p-7">
            <span
              className="pointer-events-none absolute -right-10 -bottom-16 h-44 w-44 rounded-full border border-white/20"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute top-5 right-8 h-2 w-2 rounded-full bg-white/75"
              aria-hidden="true"
            />
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-extrabold tracking-[0.14em] text-white/80 uppercase">
                UNA CHANGA, SIN VUELTAS
              </p>
              <h2 className="mt-3 max-w-xl text-[2rem] leading-[1.02] font-extrabold tracking-[-0.055em] sm:text-4xl">
                Encontrá a alguien que lo resuelva.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
                Personas con experiencia para ayudarte cerca tuyo o desde
                cualquier lugar.
              </p>
              <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Link
                  href="/buscar"
                  className="consumer-pressable bg-surface text-terracotta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold shadow-md"
                >
                  Explorar servicios <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/provider/onboarding"
                  className="consumer-pressable inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-white/90 hover:bg-white/10"
                >
                  Ofrecer mis servicios
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="categories-title">
            <SectionHeader
              title="Oficios populares"
              actionHref="/buscar"
              actionLabel="Ver todos"
            />
            <div className="consumer-scrollbar-none -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              {(categories ?? []).map((category) => (
                <CategoryTile
                  key={category.slug}
                  href={`/categoria/${category.slug}`}
                  label={category.name}
                  description={category.description}
                  icon={categoryIcon(category.slug)}
                />
              ))}
            </div>
          </section>

          <section className="mt-6" aria-labelledby="modality-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p id="modality-title" className="text-sm font-extrabold">
                  Explorá por modalidad
                </p>
                <p className="text-ink/50 mt-0.5 text-xs">
                  Elegí cómo querés recibir ayuda.
                </p>
              </div>
              <Link
                href="/buscar"
                className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
              >
                Más filtros{" "}
                <span className="ml-1" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <div className="consumer-scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <Link
                href="/buscar?mode=remoto"
                className="consumer-pressable bg-surface border-ink/[0.09] text-ink hover:border-brand-orange/40 hover:bg-surface-muted inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm"
              >
                <span className="text-moss" aria-hidden="true">
                  ◉
                </span>
                Servicios remotos
              </Link>
              <Link
                href="/buscar?mode=presencial"
                className="consumer-pressable bg-surface border-ink/[0.09] text-ink hover:border-brand-orange/40 hover:bg-surface-muted inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm"
              >
                <span className="text-terracotta" aria-hidden="true">
                  ⌖
                </span>
                Cerca tuyo
              </Link>
              <Link
                href="/buscar?offers=true"
                className="consumer-pressable bg-surface border-ink/[0.09] text-ink hover:border-brand-orange/40 hover:bg-surface-muted inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm"
              >
                <span className="text-brand-orange" aria-hidden="true">
                  $
                </span>
                Acepta ofertas
              </Link>
            </div>
          </section>

          <section className="mt-9">
            {discovery.error ? (
              <div>
                <SectionHeader
                  title="Profesionales destacados"
                  actionHref="/buscar"
                  actionLabel="Explorar más"
                />
                <p className="text-ink/58 mt-4 text-sm" role="status">
                  La búsqueda está momentáneamente en mantenimiento.
                </p>
              </div>
            ) : discovery.rows.length > 0 ? (
              <NearbyServiceRail
                rows={discovery.rows.slice(0, 6)}
                title="Profesionales destacados"
                actionHref="/buscar"
                layout="stack"
              />
            ) : (
              <EmptyState
                className="py-8"
                title="Todavía no hay servicios para mostrar"
                description="Probá buscar por categoría o publicá tu servicio para empezar a aparecer acá."
                actionHref={
                  user
                    ? "/provider/onboarding"
                    : "/login?next=/provider/onboarding"
                }
                actionLabel="Publicar un servicio"
                actionTone="secondary"
              />
            )}
          </section>

          <section className="consumer-card bg-surface-muted border-brand-orange/15 mt-7 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span
                className="feed-trust-mark bg-brand-orange/15 text-terracotta grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                aria-hidden="true"
              >
                ✦
              </span>
              <div>
                <h2 className="text-sm font-extrabold">Garantía comunitaria</h2>
                <p className="text-ink/58 mt-1 text-xs leading-5">
                  Perfiles públicos, precios claros y contacto directo para
                  elegir con confianza.
                </p>
              </div>
            </div>
            <Link
              href="/buscar"
              className="text-terracotta consumer-pressable inline-flex min-h-11 items-center text-sm font-extrabold sm:shrink-0"
            >
              Cómo funciona{" "}
              <span className="ml-1" aria-hidden="true">
                →
              </span>
            </Link>
          </section>

          {!user ? (
            <section className="consumer-card border-brand-yellow/35 bg-surface-muted mt-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="brand-kicker text-[0.68rem]">PARA CHANGUISTAS</p>
                <h2 className="mt-1 text-base font-extrabold tracking-[-0.02em]">
                  Tu oficio también merece un buen escaparate.
                </h2>
                <p className="text-ink/55 mt-1 text-xs">
                  Publicá lo que hacés y empezá a recibir consultas.
                </p>
              </div>
              <Link
                className="consumer-pressable bg-ink text-surface inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold shadow-sm"
                href="/provider/onboarding"
              >
                Ofrecer mis servicios{" "}
                <span className="ml-1" aria-hidden="true">
                  →
                </span>
              </Link>
            </section>
          ) : null}
        </div>
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
