import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { DiscoveryCard } from "@/components/discovery/discovery-card";
import { LocationPicker } from "@/components/discovery/location-picker";
import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { CategoryChip } from "@/components/ui/marketplace/category-chip";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
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
      className={`bg-canvas text-ink min-h-screen ${user ? "mobile-content-with-nav" : ""}`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8 sm:pt-5">
        <header className="bg-canvas/96 sticky top-0 z-30 -mx-4 flex min-h-16 items-center justify-between border-b border-ink/[0.06] px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:px-0 sm:backdrop-blur-none">
          <Link className="flex items-center gap-2.5" href="/" aria-label="Changas, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span className="text-lg font-bold tracking-[-0.025em]">Changas</span>
          </Link>
          {user ? (
            <Link
              href="/account"
              className="consumer-pressable flex min-h-11 items-center gap-2 rounded-full pl-2 pr-1 hover:bg-ink/[0.035]"
              aria-label="Abrir mi cuenta"
            >
              <span className="hidden text-sm font-semibold text-ink/70 sm:inline">Mi cuenta</span>
              <Avatar name={accountName} size="sm" />
            </Link>
          ) : (
            <Link
              className="consumer-pressable hover:bg-ink/[0.04] inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-ink/70"
              href="/login"
            >
              Ingresar
            </Link>
          )}
        </header>

        <section className="pt-6 sm:pt-10">
          <h1 className="max-w-xl text-[2rem] leading-[1.05] font-bold tracking-[-0.045em] sm:text-4xl">
            ¿Qué necesitás hoy?
          </h1>

          <form action="/buscar" className="mt-5 max-w-3xl">
            <SearchField
              id="home-query"
              name="q"
              placeholder="Buscar un servicio o habilidad"
              aria-label="Buscar un servicio o habilidad"
            />
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <LocationPicker compact />
              <div className="flex items-center gap-2">
                <Link
                  href="/buscar?mode=remoto"
                  className="consumer-pressable inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-ink/58 hover:bg-ink/[0.035] hover:text-ink"
                >
                  Servicios remotos
                </Link>
                <button
                  className="consumer-pressable bg-brand-orange min-h-11 rounded-xl px-4 text-sm font-bold text-ink shadow-[0_5px_14px_rgba(255,107,53,0.15)]"
                  type="submit"
                >
                  Buscar
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="mt-7" aria-labelledby="categories-title">
          <SectionHeader title="Categorías" actionHref="/buscar" actionLabel="Ver todas" />
          <div
            id="categories-title"
            className="consumer-scrollbar-none -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {(categories ?? []).map((category) => (
              <CategoryChip
                key={category.slug}
                href={`/categoria/${category.slug}`}
                label={category.name}
                description={category.description}
              />
            ))}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="published-title">
          <SectionHeader title="Servicios publicados" actionHref="/buscar" actionLabel="Buscar más" />
          {discovery.error ? (
            <p className="text-ink/58 mt-4 text-sm" role="status">
              La búsqueda está momentáneamente en mantenimiento.
            </p>
          ) : discovery.rows.length > 0 ? (
            <div id="published-title" className="mt-3 grid gap-3 md:grid-cols-2">
              {discovery.rows.map((row) => (
                <DiscoveryCard key={`${row.provider_slug}/${row.service_slug}`} row={row} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="py-8"
              title="Todavía no hay servicios para mostrar"
              description="Probá buscar por categoría o publicá tu servicio para empezar a aparecer acá."
              actionHref={user ? "/provider/onboarding" : "/login?next=/provider/onboarding"}
              actionLabel="Publicar un servicio"
              actionTone="secondary"
            />
          )}
        </section>

        {!user ? (
          <section className="mt-8 flex flex-col gap-3 border-t border-ink/[0.07] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink/55">¿Querés ofrecer tus servicios en Changas?</p>
            <Link className="font-bold text-terracotta" href="/provider/onboarding">
              Empezar como proveedor →
            </Link>
          </section>
        ) : null}
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
