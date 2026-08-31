import Link from "next/link";
import type { Metadata } from "next";

import { parseDiscoveryFilters } from "@changas/domain";

import { DiscoveryCard } from "@/components/discovery/discovery-card";
import { LocationPicker } from "@/components/discovery/location-picker";
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
  const [{ data: categories }, discovery] = await Promise.all([
    supabase
      .from("categories")
      .select("slug, name, description")
      .eq("is_active", true)
      .order("sort_order")
      .limit(6),
    searchDiscovery({ query: "", filters }),
  ]);

  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen">
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
            <span className="font-display text-xl font-semibold tracking-tight">
              Changas
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Acceso">
            <Link
              className="text-ink/65 underline underline-offset-4"
              href="/login"
            >
              Ingresar
            </Link>
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
            <p className="text-terracotta text-sm font-semibold tracking-[0.2em] uppercase">
              Servicios reales, sin vueltas
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[0.98] font-semibold tracking-[-0.04em] sm:text-7xl">
              ¿Qué necesitás?
            </h1>
            <p className="text-ink/70 mt-6 max-w-xl text-lg leading-8">
              Encontrá una persona para resolverlo cerca tuyo o elegí una changa
              remota. Podés explorar sin crear una cuenta.
            </p>

            <form
              action="/buscar"
              className="border-ink/10 mt-8 rounded-[1.5rem] border bg-white/80 p-4 shadow-[0_20px_60px_rgba(22,56,50,0.1)] sm:p-5"
            >
              <label
                className="text-ink/65 text-sm font-semibold"
                htmlFor="home-query"
              >
                Buscá por servicio o habilidad
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  className="border-ink/15 placeholder:text-ink/40 focus:border-terracotta focus:ring-terracotta/30 min-h-12 flex-1 rounded-xl border bg-white px-4 text-base outline-none focus:ring-2"
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
                className="text-moss font-semibold underline underline-offset-4"
                href="/buscar?mode=remoto"
              >
                Ver servicios remotos
              </Link>
              <Link
                className="text-ink/65 underline underline-offset-4"
                href="/provider/onboarding"
              >
                Publicar como proveedor
              </Link>
            </div>
          </div>

          <div className="bg-moss relative overflow-hidden rounded-[2rem] p-7 text-white shadow-[0_24px_80px_rgba(22,56,50,0.16)] sm:p-9">
            <div className="hero-orbit opacity-40" aria-hidden="true" />
            <p className="relative text-xs font-semibold tracking-[0.18em] text-white/65 uppercase">
              Elegí cómo resolverlo
            </p>
            <h2 className="font-display relative mt-4 max-w-sm text-4xl leading-tight font-semibold">
              Una buena changa empieza con una búsqueda clara.
            </h2>
            <div className="relative mt-8 grid gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">Cerca tuyo</p>
                <p className="mt-1 text-white/70">
                  Explorá por zona y radio aproximado, sin mostrar direcciones.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">A distancia</p>
                <p className="mt-1 text-white/70">
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
              <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
                Explorá
              </p>
              <h2
                id="categories-title"
                className="font-display mt-2 text-3xl font-semibold"
              >
                Categorías para empezar
              </h2>
            </div>
            <Link
              className="text-moss text-sm font-semibold underline underline-offset-4"
              href="/buscar"
            >
              Ver todo
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((category) => (
              <Link
                className="border-ink/10 rounded-2xl border bg-white/60 p-5 transition hover:-translate-y-0.5 hover:bg-white"
                href={"/categoria/" + category.slug}
                key={category.slug}
              >
                <h3 className="font-display text-2xl font-semibold">
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
              <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
                Para descubrir
              </p>
              <h2
                id="nearby-title"
                className="font-display mt-2 text-3xl font-semibold"
              >
                Servicios publicados
              </h2>
            </div>
            <Link
              className="text-moss text-sm font-semibold underline underline-offset-4"
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
    </main>
  );
}
