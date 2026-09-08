import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseDiscoveryFilters } from "@changas/domain";

import { DiscoveryPagination } from "@/components/discovery/discovery-pagination";
import { DiscoveryResults } from "@/components/discovery/discovery-results";
import { ConsumerShell } from "@/components/ui/consumer-shell";
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const { data: category } = await getCategory(slug);
  if (!category) notFound();
  const pageParam = Array.isArray(queryParams.page)
    ? queryParams.page[0]
    : queryParams.page;
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
    <ConsumerShell maxWidth="max-w-6xl">
      <section className="py-10 sm:py-14">
        <p className="text-terracotta text-xs font-extrabold tracking-[0.1em] uppercase">
          Categoría
        </p>
        <h1 className="product-page-title mt-3">{category.name}</h1>
        <p className="text-ink/65 mt-4 max-w-2xl text-base leading-7">
          {category.description ??
            "Explorá servicios publicados en esta categoría."}
        </p>
        <div className="mt-8">
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
                  ? "/categoria/" +
                    category.slug +
                    "?page=" +
                    (filters.page - 1)
                  : null
              }
              nextHref={
                hasMore
                  ? "/categoria/" +
                    category.slug +
                    "?page=" +
                    (filters.page + 1)
                  : null
              }
            />
          ) : null}
        </div>
      </section>
    </ConsumerShell>
  );
}
