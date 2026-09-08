import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { ProviderReputation } from "@/components/reputation/provider-reputation";
import { ConsumerShell } from "@/components/ui/consumer-shell";
import { toggleProviderFavorite } from "@/lib/favorites/actions";
import { createClient } from "@/lib/supabase/server";
import {
  formatDistanceMeters,
  getModalityLabel,
} from "@/lib/ui/marketplace-labels";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const pageSearchParams = await searchParams;
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
    <ConsumerShell maxWidth="max-w-5xl">
      <section className="border-ink/10 bg-surface mt-8 rounded-[1.75rem] border p-5 shadow-[0_18px_50px_rgba(32,33,36,0.06)] sm:mt-10 sm:p-8">
        {pageSearchParams.favoriteError ? (
          <p className="bg-danger/8 text-danger mb-5 rounded-xl px-4 py-3 text-sm" role="alert">
            No pudimos actualizar el proveedor guardado. Intentá nuevamente.
          </p>
        ) : null}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <div className="bg-brand-yellow/20 text-terracotta grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl text-2xl font-extrabold sm:h-24 sm:w-24">
              {provider.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={provider.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                provider.display_name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="product-kicker">Profesional en Changas</p>
              <h1 className="product-page-title mt-2 break-words">
                {provider.display_name}
              </h1>
              <p className="text-moss mt-2 text-base font-bold sm:text-lg">
                {provider.public_headline ?? "Servicios publicados"}
              </p>
              {provider.public_zone ? (
                <p className="text-ink/60 mt-2 text-sm">
                  {provider.public_zone}
                </p>
              ) : null}
            </div>
          </div>

          <form action={toggleProviderFavorite} className="shrink-0">
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
            <button className="button-secondary w-full sm:w-auto" type="submit">
              {isFavorite ? "Quitar de guardados" : "Guardar"}
            </button>
          </form>
        </div>

        <p className="text-ink/65 mt-5 max-w-3xl text-sm leading-6 sm:text-base sm:leading-7">
          {provider.bio ?? "Este profesional todavía no agregó una presentación."}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="provider-services-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="product-kicker">Qué ofrece</p>
            <h2 id="provider-services-title" className="product-section-title mt-1">
              Servicios
            </h2>
          </div>
          <span className="text-ink/45 text-xs font-bold">
            {(services ?? []).length} publicado{(services ?? []).length === 1 ? "" : "s"}
          </span>
        </div>

        {(services ?? []).length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(services ?? []).map((service) => (
              <Link
                className="border-ink/10 bg-surface hover:border-brand-orange/35 group rounded-2xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] transition-colors"
                href={`/p/${slug}/${service.public_slug}`}
                key={service.public_slug}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-terracotta text-xs font-bold">
                      {service.skill_name}
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold tracking-[-0.02em] group-hover:underline">
                      {service.title}
                    </h3>
                  </div>
                  <span className="bg-moss/8 text-moss shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                    {getModalityLabel(service.modality)}
                  </span>
                </div>
                <p className="text-ink/60 mt-3 line-clamp-2 text-sm leading-6">
                  {service.description}
                </p>
                <p className="mt-4 text-base font-extrabold">
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
        ) : (
          <p className="border-ink/10 bg-surface text-ink/60 mt-4 rounded-2xl border p-5 text-sm">
            Este profesional todavía no tiene servicios publicados.
          </p>
        )}
      </section>

      <ProviderReputation providerSlug={provider.public_slug} />

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {(skills ?? []).length > 0 ? (
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
          ) : null}

          {(areas ?? []).length > 0 ? (
            <PublicCard title="Zona de servicio">
              <div className="space-y-3">
                {(areas ?? []).map((area) => (
                  <div key={`${area.label}-${area.radius_meters}`}>
                    <p className="font-bold">{area.label}</p>
                    <p className="text-ink/55 mt-0.5 text-sm">
                      Hasta {formatDistanceMeters(area.radius_meters)} aprox.
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-ink/50 mt-4 text-xs">
                La dirección exacta se mantiene privada.
              </p>
            </PublicCard>
          ) : null}

          {(education ?? []).length > 0 ? (
            <PublicCard title="Formación">
              <div className="space-y-4">
                {(education ?? []).map((item) => (
                  <div key={`${item.institution}-${item.started_on}`}>
                    <p className="font-bold">{item.institution}</p>
                    <p className="text-ink/55 text-sm">
                      {item.field_of_study ?? "Formación"}
                    </p>
                  </div>
                ))}
              </div>
            </PublicCard>
          ) : null}
        </div>

        <div className="space-y-6">
          {(experiences ?? []).length > 0 ? (
            <PublicCard title="Experiencia">
              <div className="space-y-4">
                {(experiences ?? []).map((item) => (
                  <div key={`${item.title}-${item.started_on}`}>
                    <p className="font-bold">{item.title}</p>
                    <p className="text-ink/55 text-sm">
                      {item.organization ?? "Experiencia independiente"}
                    </p>
                    {item.description ? (
                      <p className="text-ink/65 mt-1 text-sm leading-6">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </PublicCard>
          ) : null}

          {(certifications ?? []).length > 0 ? (
            <PublicCard title="Certificaciones">
              <div className="space-y-3">
                {(certifications ?? []).map((item) => (
                  <div key={`${item.title}-${item.issued_on}`}>
                    <p className="font-bold">{item.title}</p>
                    <p className="text-ink/55 text-sm">
                      {item.issuer ?? "Emisor no especificado"}
                    </p>
                  </div>
                ))}
              </div>
            </PublicCard>
          ) : null}

          {(portfolio ?? []).length > 0 ? (
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
                    <p className="font-bold">{item.title}</p>
                    {item.description ? (
                      <p className="text-ink/60 mt-1 text-sm">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </PublicCard>
          ) : null}
        </div>
      </section>

      <footer className="text-ink/45 py-8 text-center text-xs">
        Changas · información publicada por el profesional
      </footer>
    </ConsumerShell>
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
    <section className="border-ink/10 bg-surface rounded-2xl border p-5 shadow-[0_8px_24px_rgba(32,33,36,0.025)] sm:p-6">
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
