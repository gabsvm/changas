import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/favorites");

  const { data: favorites } = await supabase.rpc("list_my_favorite_providers");

  return (
    <section className="py-10 sm:py-14">
      <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
        Mi cuenta
      </p>
      <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
        Proveedores guardados
      </h1>
      <p className="text-ink/65 mt-4 max-w-xl text-sm leading-6">
        Guardá proveedores para volver a encontrarlos sin guardar datos
        privados.
      </p>
      {favorites?.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {favorites.map((provider) => (
            <Link
              className="border-ink/10 rounded-2xl border bg-white/70 p-5 transition hover:-translate-y-0.5 hover:bg-white"
              href={"/p/" + provider.provider_slug}
              key={provider.provider_slug}
            >
              <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
                Proveedor público
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold">
                {provider.display_name}
              </h2>
              <p className="text-moss mt-2 text-sm font-semibold">
                {provider.public_headline ?? "Servicios publicados"}
              </p>
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
