import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { toggleProviderFavorite } from "@/lib/favorites/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("public_provider_profiles")
    .select("public_slug, display_name, public_headline, bio")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!provider) return { title: "Proveedor no encontrado" };
  const description =
    provider.bio ??
    provider.public_headline ??
    "Servicios publicados en Changas.";
  return {
    title: provider.display_name,
    description,
    alternates: { canonical: "/p/" + provider.public_slug },
    openGraph: {
      title: provider.display_name + " · Changas",
      description,
      type: "profile",
      url: "/p/" + provider.public_slug,
    },
  };
}

export default async function PublicProviderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("public_provider_profiles")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!provider) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: favoriteProviders } = user
    ? await supabase.rpc("list_my_favorite_providers")
    : { data: null };
  const isFavorite =
    favoriteProviders?.some(
      (favorite) => favorite.provider_slug === provider.public_slug,
    ) ?? false;

  const [
    { data: skills },
    { data: services },
    { data: experiences },
    { data: education },
    { data: certifications },
    { data: portfolio },
    { data: areas },
  ] = await Promise.all([
    supabase
      .from("public_provider_skills")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_services")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_experiences")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_education")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_certifications")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_portfolio")
      .select("*")
      .eq("provider_slug", slug)
      .order("sort_order"),
    supabase
      .from("public_provider_service_areas")
      .select("*")
      .eq("provider_slug", slug),
  ]);

  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
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
          <span className="text-ink/50 text-xs font-semibold tracking-[0.16em] uppercase">
            Perfil público
          </span>
        </header>
        <section className="border-ink/10 mt-10 rounded-[2rem] border bg-white/70 p-7 shadow-[0_24px_80px_rgba(22,56,50,0.08)] sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
                Perfil activo
              </p>
              <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
                {provider.display_name}
              </h1>
              <p className="text-moss mt-4 text-lg font-semibold">
                {provider.public_headline ?? "Servicios hechos con criterio"}
              </p>
              <p className="text-ink/65 mt-3 max-w-2xl text-sm leading-6">
                {provider.bio ??
                  "Este proveedor todavía no agregó una presentación."}
              </p>
            </div>
            <form action={toggleProviderFavorite}>
              <input
                name="providerSlug"
                type="hidden"
                value={provider.public_slug}
              />
              <input
                name="returnTo"
                type="hidden"
                value={"/p/" + provider.public_slug}
              />
              <input
                name="shouldFavorite"
                type="hidden"
                value={String(!isFavorite)}
              />
              <button
                className="button-secondary whitespace-nowrap"
                type="submit"
              >
                {isFavorite ? "Quitar guardado" : "Guardar proveedor"}
              </button>
            </form>
          </div>
          {provider.public_zone ? (
            <p className="text-ink/60 mt-6 text-sm">
              Zona aproximada:{" "}
              <strong className="text-ink">{provider.public_zone}</strong>
            </p>
          ) : null}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <PublicCard title="Habilidades">
              <div className="flex flex-wrap gap-2">
                {(skills ?? []).map((skill) => (
                  <span
                    className="border-ink/10 rounded-full border bg-white/70 px-3 py-2 text-sm"
                    key={skill.skill_slug}
                  >
                    {skill.skill_name}
                  </span>
                ))}
              </div>
            </PublicCard>
            <PublicCard title="Zona de servicio">
              <div className="space-y-3">
                {(areas ?? []).map((area) => (
                  <div key={`${area.label}-${area.radius_meters}`}>
                    <p className="font-semibold">{area.label}</p>
                    <p className="text-ink/55 text-sm">
                      Radio aproximado: {area.radius_meters} m
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-ink/50 mt-4 text-xs">
                No mostramos dirección exacta ni coordenadas.
              </p>
            </PublicCard>
            <PublicCard title="Formación">
              <div className="space-y-4">
                {(education ?? []).map((item) => (
                  <div key={`${item.institution}-${item.started_on}`}>
                    <p className="font-semibold">{item.institution}</p>
                    <p className="text-ink/55 text-sm">
                      {item.field_of_study ?? "Formación"}
                    </p>
                  </div>
                ))}
              </div>
            </PublicCard>
          </div>
          <div className="space-y-6">
            <PublicCard title="Servicios">
              <div className="grid gap-4">
                {(services ?? []).map((service) => (
                  <Link
                    className="border-ink/10 group rounded-2xl border bg-white/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                    href={`/p/${slug}/${service.public_slug}`}
                    key={service.public_slug}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
                          {service.skill_name}
                        </p>
                        <h3 className="font-display mt-2 text-2xl font-semibold group-hover:underline">
                          {service.title}
                        </h3>
                      </div>
                      <span className="bg-moss/10 text-moss rounded-full px-3 py-1 text-xs font-semibold">
                        {service.modality}
                      </span>
                    </div>
                    <p className="text-ink/65 mt-3 line-clamp-3 text-sm leading-6">
                      {service.description}
                    </p>
                    <p className="text-ink mt-4 text-sm font-semibold">
                      {formatServicePrice(
                        service.price_model,
                        service.price_amount,
                        service.currency_code,
                        service.price_unit,
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </PublicCard>
            <PublicCard title="Experiencia">
              <div className="space-y-4">
                {(experiences ?? []).map((item) => (
                  <div key={`${item.title}-${item.started_on}`}>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-ink/55 text-sm">
                      {item.organization ?? "Experiencia independiente"}
                    </p>
                    <p className="text-ink/65 mt-1 text-sm">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </PublicCard>
            <PublicCard title="Certificaciones">
              <div className="space-y-3">
                {(certifications ?? []).map((item) => (
                  <div key={`${item.title}-${item.issued_on}`}>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-ink/55 text-sm">
                      {item.issuer ?? "Emisor no especificado"}
                    </p>
                  </div>
                ))}
              </div>
            </PublicCard>
            {(portfolio ?? []).length ? (
              <PublicCard title="Portfolio">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(portfolio ?? []).map((item) => (
                    <div
                      className="border-ink/10 rounded-xl border bg-white/70 p-4"
                      key={item.id}
                    >
                      {item.media_path ? (
                        <Image
                          className="mb-3 aspect-video w-full rounded-lg object-cover"
                          src={`/api/portfolio/${item.media_path.split("/").map(encodeURIComponent).join("/")}`}
                          alt=""
                          width={640}
                          height={360}
                          unoptimized
                        />
                      ) : null}
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-ink/60 mt-1 text-sm">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </PublicCard>
            ) : null}
          </div>
        </section>
        <footer className="text-ink/45 py-8 text-center text-xs">
          Changas · información publicada por el proveedor
        </footer>
      </div>
    </main>
  );
}

function PublicCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-ink/10 rounded-2xl border bg-white/55 p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
