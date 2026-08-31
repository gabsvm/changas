import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseDiscoveryFilters } from "@changas/domain";

import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { searchDiscovery } from "@/lib/discovery/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getCategory(slug: string) {
  const supabase = await createClient();
  return supabase
    .from("categories")
    .select("slug, name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: category } = await getCategory(slug);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description:
      category.description ?? "Servicios y habilidades publicados en Changas.",
    alternates: { canonical: "/categoria/" + category.slug },
    openGraph: {
      title: category.name + " · Changas",
      description:
        category.description ??
        "Servicios y habilidades publicados en Changas.",
      type: "website",
      url: "/categoria/" + category.slug,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: category } = await getCategory(slug);
  if (!category) notFound();
  const filters = parseDiscoveryFilters({ category: category.slug });
  const { rows } = await searchDiscovery({ query: "", filters });

  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-semibold">Changas</span>
          </Link>
          <Link
            className="text-ink/65 text-sm underline underline-offset-4"
            href="/buscar"
          >
            Buscar
          </Link>
        </header>
        <section className="py-10 sm:py-14">
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Categoría pública
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            {category.name}
          </h1>
          <p className="text-ink/65 mt-4 max-w-2xl text-base leading-7">
            {category.description ??
              "Explorá servicios publicados en esta categoría."}
          </p>
          <div className="mt-8">
            <DiscoveryResults initialRows={rows} query="" filters={filters} />
          </div>
        </section>
      </div>
    </main>
  );
}
