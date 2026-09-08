import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { DiscoveryCard } from "@/components/discovery/discovery-card";
import { LocationPicker } from "@/components/discovery/location-picker";
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
      .limit(6),
    searchDiscovery({ query: "", filters }),
  ]);
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;

  return (
    <main
      id="main-content"
      className={`bg-canvas text-ink min-h-screen ${
        user ? "mobile-content-with-nav" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-5 sm:px-8 lg:px-10">
        <header className="border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-extrabold tracking-[-0.035em]">
              Changas
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Acceso">
            {user ? (
              <Link
                className="text-ink/65 decoration-terracotta/40 hover:text-terracotta underline underline-offset-4 transition"
                href="/account"
              >
                Mi cuenta
              </Link>
            ) : (
              <Link
                className="text-ink/65 decoration-terracotta/40 hover:text-terracotta underline underline-offset-4 transition"
                href="/login"
              >
                Ingresar
              </Link>
            )}
            <Link
              className="button-secondary hidden sm:inline-flex"
              href="/provider/onboarding"
            >
              Soy proveedor
            </Link>
          </nav>
        </header>

        <section className="grid gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <p className="text-terracotta text-sm font-extrabold tracking-[0.18em] uppercase">
              Servicios reales, sin vueltas
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[0.98] font-extrabold tracking-[-0.055em] sm:text-7xl">
              ¿Qué necesitás?
            </h1>
            <p className="text-ink/70 mt-6 max-w-xl text-lg leading-8">
              Encontrá una persona para resolverlo cerca tuyo o elegí una changa
              remota. Podés explorar sin crear una cuenta.
            </p>

            <form
              action="/buscar"
              className="border-ink/10 bg-surface mt-8 rounded-[1.6rem] border p-4 shadow-[0_20px_60px_rgba(255,107,53,0.10)] sm:p-5"
            >
              <label
                className="text-ink/65 text-sm font-bold"
                htmlFor="home-query"
              >
                Buscá por servicio o habilidad
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  className="border-ink/15 placeholder:text-ink/40 focus:border-moss focus:ring-moss/20 min-h-12 flex-1 rounded-xl border bg-white px-4 text-base outline-none focus:ring-2"
                  id="home-query"
                  name="q"
                  placeholder="Ej. electricista, arreglar pc…"
                  type="search"
                />
                <button className="button-primary min-h-12" type="submit">
                  Buscar
                </button>
              </div>
              <div className="mt-4">
                <LocationPicker />
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                className="text-moss decoration-moss/30 font-bold underline underline-offset-4"
                href="/buscar?mode=remoto"
              >
                Ver servicios remotos
              </Link>
              <Link
                className="text-ink/65 decoration-terracotta/35 underline underline-offset-4"
                href="/provider/onboarding"
              >
                Publicar como proveedor
              </Link>
            </div>
          </div>

          <div className="brand-gradient-surface text-ink relative overflow-hidden rounded-[2.15rem] p-7 sm:p-9">
            <div className="hero-orbit opacity-70" aria-hidden="true" />
            <p className="text-ink/70 relative text-xs font-extrabold tracking-[0.18em] uppercase">
              Elegí cómo resolverlo
            </p>
            <h2 className="font-display relative mt-4 max-w-sm text-4xl leading-tight font-extrabold tracking-[-0.04em]">
              Una buena changa empieza con una búsqueda clara.
            </h2>
            <div className="relative mt-8 grid gap-3 text-sm">
              <div className="border-ink/10 rounded-2xl border bg-white/75 p-4 backdrop-blur-sm">
                <p className="font-extrabold">Cerca tuyo</p>
                <p className="text-ink/65 mt-1">
                  Explorá por zona y radio aproximado, sin mostrar direcciones.
                </p>
              </div>
              <div className="border-ink/10 rounded-2xl border bg-white/75 p-4 backdrop-blur-sm">
                <p className="font-extrabold">A distancia</p>
                <p className="text-ink/65 mt-1">
                  Las habilidades remotas están disponibles estés donde estés.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="border-ink/10 border-t py-10"
          aria-labelledby="categories-title"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-terracotta text-xs font-extrabold tracking-[0.16em] uppercase">
                Explorá
              </p>
              <h2
                id="categories-title"
                className="font-display mt-2 text-3xl font-extrabold tracking-[-0.035em]"
              >
                Categorías para empezar
              </h2>
            </div>
            <Link
              className="text-moss decoration-moss/30 text-sm font-bold underline underline-offset-4"
              href="/buscar"
            >
              Ver todo
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((category) => (
              <Link
                className="border-ink/10 bg-surface/85 hover:border-terracotta/25 hover:bg-surface rounded-2xl border p-5 shadow-[0_8px_24px_rgba(32,33,36,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(255,107,53,0.10)]"
                href={"/categoria/" + category.slug}
                key={category.slug}
              >
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.03em]">
                  {category.name}
                </h3>
                <p className="text-ink/60 mt-2 text-sm leading-6">
                  {category.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-10" aria-labelledby="nearby-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-terracotta text-xs font-extrabold tracking-[0.16em] uppercase">
                Para descubrir
              </p>
              <h2
                id="nearby-title"
                className="font-display mt-2 text-3xl font-extrabold tracking-[-0.035em]"
              >
                Servicios publicados
              </h2>
            </div>
            <Link
              className="text-moss decoration-moss/30 text-sm font-bold underline underline-offset-4"
              href="/buscar"
            >
              Buscar más
            </Link>
          </div>
          {discovery.error ? (
            <p className="text-ink/60 mt-5 text-sm">
              La búsqueda está momentáneamente en mantenimiento.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {discovery.rows.map((row) => (
                <DiscoveryCard
                  key={row.provider_slug + "/" + row.service_slug}
                  row={row}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="border-ink/10 text-ink/50 flex flex-col gap-2 border-t py-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>Changas · descubrí servicios y habilidades</span>
          <span>Sin ratings ni promesas inventadas.</span>
        </footer>
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
