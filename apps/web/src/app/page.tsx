import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

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
      className="feed-home bg-canvas text-ink mobile-content-with-nav min-h-screen"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8 sm:pt-5">
        <header className="bg-canvas/90 border-ink/[0.06] sticky top-0 z-30 -mx-4 flex min-h-14 items-center justify-between border-b px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
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
              <span className="text-ink/60 block truncate text-[13px] leading-4 font-medium">
                {user ? "¿Qué resolvemos hoy?" : "Servicios cerca tuyo"}
              </span>
            </span>
          </Link>
          {user ? (
            <Link
              href="/account"
              className="consumer-pressable hover:bg-ink/[0.04] flex h-12 w-12 items-center justify-center rounded-full"
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
          <section aria-labelledby="home-search-title" className="sm:hidden">
            <h1 id="home-search-title" className="sr-only">
              Buscar servicios en Changas
            </h1>
            <form action="/buscar" className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchField
                  id="home-query-mobile"
                  name="q"
                  placeholder="¿Qué necesitás resolver hoy?"
                  aria-label="Buscar un servicio o habilidad"
                />
              </div>
              <button
                className="consumer-pressable bg-brand-orange text-ink grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl shadow-[0_6px_16px_rgba(255,107,53,0.22)]"
                type="submit"
                aria-label="Buscar servicios"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            <div className="consumer-scrollbar-none -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
              <Link
                href="/buscar?mode=remoto"
                className="consumer-pressable bg-surface border-ink/[0.08] inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold shadow-sm"
              >
                Remoto
              </Link>
              <Link
                href="/buscar?mode=presencial"
                className="consumer-pressable bg-surface border-ink/[0.08] inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold shadow-sm"
              >
                Cerca mío
              </Link>
              <Link
                href="/buscar?offers=true"
                className="consumer-pressable bg-surface border-ink/[0.08] inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold shadow-sm"
              >
                Acepta ofertas
              </Link>
            </div>
          </section>

          <section
            className="home-search-panel consumer-card bg-surface hidden p-3 sm:block sm:p-4"
            aria-labelledby="home-search-title-desktop"
          >
            <div className="px-1 pb-2 sm:px-2">
              <p className="brand-kicker text-xs font-extrabold tracking-[0.12em] uppercase">
                Buscá a tu manera
              </p>
              <h1
                id="home-search-title-desktop"
                className="mt-1 text-xl font-extrabold tracking-[-0.03em] sm:text-2xl"
              >
                ¿Qué necesitás resolver hoy?
              </h1>
            </div>
            <form action="/buscar" className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchField
                  className="min-h-14"
                  id="home-query"
                  name="q"
                  placeholder="¿Qué changa o servicio necesitás?"
                  aria-label="Buscar un servicio o habilidad"
                />
              </div>
              <button
                className="consumer-pressable bg-brand-orange text-ink inline-flex min-h-14 items-center rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap shadow-[0_6px_16px_rgba(255,107,53,0.22)]"
                type="submit"
              >
                Buscar
              </button>
            </form>
          </section>

          <section className="quick-action-card brand-gradient-surface relative mt-4 overflow-hidden rounded-[1.25rem] p-5 text-white shadow-[var(--consumer-shadow-hero)] sm:mt-5 sm:p-7">
            <div className="relative z-10 max-w-2xl">
              <h2 className="max-w-xl text-[1.65rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-4xl">
                Encontrá a alguien que lo resuelva.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
                Personas con experiencia cerca tuyo o desde cualquier lugar.
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Link
                  href="/buscar"
                  className="consumer-pressable bg-surface text-terracotta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold shadow-md"
                >
                  Explorar servicios
                </Link>
                <Link
                  href="/provider/onboarding"
                  className="consumer-pressable inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-white hover:bg-white/10"
                >
                  Ofrecer mis servicios
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-6" aria-labelledby="categories-title">
            <div id="categories-title">
              <SectionHeader
                title="Oficios populares"
                actionHref="/buscar"
                actionLabel="Ver todos"
              />
            </div>
            <div className="consumer-scrollbar-none consumer-snap-rail -mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
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
                />
                <p className="text-ink/60 mt-3 text-sm" role="status">
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

          <section className="consumer-card bg-surface mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span
                className="feed-trust-mark bg-brand-orange/15 text-terracotta grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path
                    d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m9 11.5 2.2 2.2L15.5 9"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-[15px] font-extrabold">Elegí con confianza</h2>
                <p className="text-ink/60 mt-1 text-[13px] leading-5">
                  Perfiles públicos, precios claros y reseñas de trabajos reales.
                </p>
              </div>
            </div>
            <Link
              href="/buscar"
              className="text-terracotta consumer-pressable inline-flex min-h-11 items-center text-sm font-extrabold sm:shrink-0"
            >
              Cómo funciona
            </Link>
          </section>

          {!user ? (
            <section className="consumer-card bg-ink mt-4 flex flex-col gap-3 p-5 text-white">
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em]">
                  Tu oficio merece un buen escaparate.
                </h2>
                <p className="mt-1 text-[13px] text-white/70">
                  Publicá lo que hacés y empezá a recibir consultas.
                </p>
              </div>
              <Link
                className="consumer-pressable bg-brand-yellow text-ink inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-extrabold"
                href="/provider/onboarding"
              >
                Ofrecer mis servicios
              </Link>
            </section>
          ) : null}
        </div>
      </div>
      <AuthenticatedBottomNav unreadCount={unreadCount} />
    </main>
  );
}
