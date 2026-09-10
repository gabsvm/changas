import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { ProviderCard } from "@/components/ui/marketplace/provider-card";
import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function percent(value: number | null): string {
  return value === null ? "Sin datos" : `${Math.round(value * 100)}%`;
}

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/favorites");

  const { data: favorites } = await (
    supabase as unknown as {
      rpc(name: "list_my_favorite_providers_v2"): Promise<{
        data: Array<{
          provider_slug: string;
          display_name: string;
          avatar_url: string | null;
          public_zone: string | null;
          public_headline: string | null;
          bio: string | null;
          rating_average: number | null;
          review_count: number;
          completed_jobs: number;
          completion_rate: number | null;
          repeat_client_count: number;
        }> | null;
        error: unknown;
      }>;
    }
  ).rpc("list_my_favorite_providers_v2");

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Guardados" backHref="/account" />
      <div className="mx-auto max-w-3xl pt-5 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Mi cuenta
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Proveedores guardados
        </h1>
        <p className="text-ink/55 mt-1.5 text-sm leading-6">
          Volvé rápido a los profesionales que querés comparar o contratar.
        </p>

        {favorites?.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {favorites.map((provider) => {
              const rating =
                provider.rating_average !== null && provider.review_count > 0
                  ? `★ ${provider.rating_average.toFixed(1)} · ${provider.review_count} ${provider.review_count === 1 ? "reseña" : "reseñas"}`
                  : "Nuevo proveedor";
              const reputation = `${provider.completed_jobs} completados · ${percent(provider.completion_rate)} finalización${
                provider.repeat_client_count > 0
                  ? ` · ${provider.repeat_client_count} recurrentes`
                  : ""
              }`;
              const subtitle =
                provider.public_headline ?? provider.public_zone ?? "Servicios publicados";
              const meta = provider.public_zone
                ? `${rating} · ${provider.public_zone}`
                : `${rating} · ${reputation}`;

              return (
                <ProviderCard
                  key={provider.provider_slug}
                  href={`/p/${provider.provider_slug}`}
                  name={provider.display_name}
                  avatarUrl={
                    isTrustedPublicAvatarUrl(provider.avatar_url)
                      ? provider.avatar_url
                      : null
                  }
                  subtitle={subtitle}
                  meta={meta}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Todavía no guardaste proveedores"
            description="Explorá servicios y guardá a quien quieras volver a encontrar."
            actionHref="/buscar"
            actionLabel="Explorar servicios"
            className="pt-14"
          />
        )}
      </div>
    </section>
  );
}
