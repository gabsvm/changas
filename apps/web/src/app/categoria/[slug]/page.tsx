import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseDiscoveryFilters } from "@changas/domain";

import { DiscoveryPagination } from "@/components/discovery/discovery-pagination";
import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { AppHeader } from "@/components/ui/marketplace/app-header";
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
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: {
      title: `${category.name} · Changas`,
      description:
        category.description ?? "Servicios y habilidades publicados en Changas.",
      type: "website",
      url: `/categoria/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const { data: category } = await getCategory(slug);
  if (!category) notFound();
  const pageParam = Array.isArray(queryParams.page) ? queryParams.page[0] : queryParams.page;
  const pageSizeParam = Array.isArray(queryParams.pageSize)
    ? queryParams.pageSize[0]
    : queryParams.pageSize;
  const filters = parseDiscoveryFilters({
    category: category.slug,
    page: pageParam,
    pageSize: pageSizeParam,
  });
  const searchResult = await searchDiscovery({ query: "", filters });
  const { rows, hasMore } = searchResult;

  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8 sm:pt-5">
        <AppHeader
          brand
          action={
            <Link
              className="consumer-pressable inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold text-terracotta hover:bg-brand-orange/[0.07]"
              href="/buscar"
            >
              Buscar
            </Link>
          }
          className="sm:flex"
        />
        <section className="pt-5 sm:pt-9">
          <p className="text-ink/48 text-xs font-semibold">Categoría</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            {category.name}
          </h1>
          {category.description ? (
            <p className="text-ink/58 mt-2 max-w-2xl text-sm leading-6 sm:text-base">
              {category.description}
            </p>
          ) : null}
          <div className="mt-5">
            <DiscoveryResults
              enableNearby={false}
              initialError={searchResult.error}
              initialHasMore={hasMore}
              initialRows={rows}
              query=""
              filters={filters}
            />
            {!searchResult.error ? (
              <DiscoveryPagination
                previousHref={
                  filters.page > 1
                    ? `/categoria/${category.slug}?page=${filters.page - 1}`
                    : null
                }
                nextHref={
                  hasMore
                    ? `/categoria/${category.slug}?page=${filters.page + 1}`
                    : null
                }
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
