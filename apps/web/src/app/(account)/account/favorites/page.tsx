import Link from "next/link";
import { redirect } from "next/navigation";

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
        data:
          | Array<{
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
            }>
          | null;
        error: unknown;
      }>;
    }
  ).rpc("list_my_favorite_providers_v2");

  return (
    <section className="py-10 sm:py-14">
      <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
        Mi cuenta
      </p>
      <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
        Proveedores guardados
      </h1>
      <p className="text-ink/65 mt-4 max-w-xl text-sm leading-6">
        Guardá proveedores para volver a encontrarlos y comparar su reputación
        verificada sin guardar datos privados.
      </p>
      {favorites?.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {favorites.map((provider) => (
            <Link
              className="border-ink/10 rounded-2xl border bg-white/70 p-5 transition hover:-translate-y-0.5 hover:bg-white"
              href={"/p/" + provider.provider_slug}
              key={provider.provider_slug}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
                    Proveedor guardado
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-semibold">
                    {provider.display_name}
                  </h2>
                </div>
                <span className="bg-moss/10 text-moss rounded-full px-3 py-1 text-xs font-bold">
                  {provider.rating_average !== null && provider.review_count > 0
                    ? `★ ${provider.rating_average.toFixed(1)}`
                    : "Nuevo"}
                </span>
              </div>
              <p className="text-moss mt-2 text-sm font-semibold">
                {provider.public_headline ?? "Servicios publicados"}
              </p>
              <div className="text-ink/55 mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>
                  {provider.review_count} {provider.review_count === 1 ? "reseña" : "reseñas"}
                </span>
                <span>{provider.completed_jobs} completados</span>
                <span>{percent(provider.completion_rate)} finalización</span>
                {provider.repeat_client_count > 0 ? (
                  <span>{provider.repeat_client_count} clientes recurrentes</span>
                ) : null}
              </div>
              {provider.public_zone ? (
                <p className="text-ink/55 mt-3 text-sm">
                  Zona aproximada: {provider.public_zone}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-ink/10 mt-8 rounded-2xl border border-dashed bg-white/45 p-8">
          <p className="font-display text-2xl font-semibold">
            Todavía no guardaste proveedores
          </p>
          <p className="text-ink/60 mt-2 text-sm">
            Explorá servicios y usá Guardar cuando encuentres a alguien.
          </p>
          <Link className="button-primary mt-5" href="/buscar">
            Explorar servicios
          </Link>
        </div>
      )}
    </section>
  );
}
