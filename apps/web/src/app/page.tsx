import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { LocationPicker } from "@/components/discovery/location-picker";
import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { BrandHero } from "@/components/ui/marketplace/brand-hero";
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
        <header className="bg-canvas/96 border-ink/[0.06] sticky top-0 z-30 -mx-4 flex min-h-16 items-center justify-between border-b px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:px-0 sm:backdrop-blur-none">
          <Link
            className="flex items-center gap-2.5"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="text-lg font-bold tracking-[-0.025em]">
              Changas
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
              className="consumer-pressable hover:bg-ink/[0.04] text-ink/70 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold"
              href="/login"
            >
              Ingresar
            </Link>
          )}
        </header>

        <BrandHero
          eyebrow="Encontrá ayuda cerca tuyo"
          title="¿Qué necesitás resolver hoy?"
          description="Conectá con personas que saben hacerlo, cerca tuyo o de forma remota."
        >
          <form action="/buscar" className="brand-hero-search max-w-3xl">
            <SearchField
              id="home-query"
              name="q"
              placeholder="¿Qué ayuda necesitás?"
              aria-label="Buscar un servicio o habilidad"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <LocationPicker compact />
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Link
                  href="/buscar?mode=remoto"
                  className="consumer-pressable text-ink/58 hover:bg-ink/[0.035] hover:text-ink inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap sm:min-h-12"
                >
                  Servicios remotos{" "}
                  <span className="chevron" aria-hidden="true">
                    →
                  </span>
                </Link>
                <button
                  className="consumer-pressable bg-brand-orange text-ink min-h-12 w-full rounded-xl px-4 text-sm font-bold whitespace-nowrap shadow-[0_8px_18px_rgba(255,107,53,0.24)] sm:w-auto"
                  type="submit"
                >
                  Explorar servicios
                </button>
              </div>
            </div>
          </form>
        </BrandHero>

        <section className="mt-7" aria-labelledby="categories-title">
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

        <section className="mt-9">
          {discovery.error ? (
            <div>
              <SectionHeader
                title="Tareas cerca tuyo"
                actionHref="/buscar"
                actionLabel="Ver todo"
              />
              <p className="text-ink/58 mt-4 text-sm" role="status">
                La búsqueda está momentáneamente en mantenimiento.
              </p>
            </div>
          ) : discovery.rows.length > 0 ? (
            <NearbyServiceRail
              rows={discovery.rows.slice(0, 3)}
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

        <section
          className="consumer-card border-brand-orange/15 bg-surface-muted mt-7 flex items-start gap-3 p-4 sm:p-5"
          aria-label="Garantía comunitaria"
        >
          <span
            className="bg-brand-orange/15 text-terracotta grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
            aria-hidden="true"
          >
            ✦
          </span>
          <div>
            <h2 className="text-sm font-extrabold">Garantía comunitaria</h2>
            <p className="text-ink/58 mt-1 text-xs leading-5">
              Perfiles públicos, precios claros y contacto directo para que
              elijas con confianza.
            </p>
          </div>
        </section>

        {!user ? (
          <section className="border-ink/[0.07] mt-8 flex flex-col gap-3 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink/55">
              ¿Querés ofrecer tus servicios en Changas?
            </p>
            <Link
              className="text-terracotta font-bold"
              href="/provider/onboarding"
            >
              Empezar como proveedor →
            </Link>
          </section>
        ) : null}
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
