import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { formatServicePrice } from "@changas/domain";

import { ProviderReputation } from "@/components/reputation/provider-reputation";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import { toggleProviderFavorite } from "@/lib/favorites/actions";
import { createClient } from "@/lib/supabase/server";
import { getServiceModalityLabel } from "@/lib/ui/service-modality";

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
    <main id="main-content" className="bg-canvas text-ink min-h-screen px-4 py-4 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="border-ink/10 flex min-h-14 items-center justify-between gap-4 border-b pb-3">
          <Link
            className="consumer-pressable flex min-h-11 items-center gap-2 rounded-lg px-1"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="text-base font-extrabold tracking-[-0.025em]">Changas</span>
          </Link>
          <Link
            className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
            href="/buscar"
          >
            Buscar
          </Link>
        </header>

        <section className="pt-6 sm:pt-8">
          {pageSearchParams.favoriteError ? (
            <p className="bg-danger/[0.07] text-danger mb-4 rounded-xl px-3 py-2.5 text-sm" role="alert">
              No pudimos actualizar el proveedor guardado. Intentá nuevamente.
            </p>
          ) : null}

          <div className="flex items-start gap-4">
            <Avatar
              name={provider.display_name}
              src={
                isTrustedPublicAvatarUrl(provider.avatar_url)
                  ? provider.avatar_url
                  : null
              }
              size="lg"
              className="h-16 w-16 text-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="success">Proveedor verificado</StatusChip>
                {provider.public_zone ? (
                  <span className="text-ink/48 text-xs">{provider.public_zone}</span>
                ) : null}
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
                {provider.display_name}
              </h1>
              {provider.public_headline ? (
                <p className="text-terracotta mt-1 text-base font-semibold">
                  {provider.public_headline}
                </p>
              ) : null}
            </div>
          </div>

          {provider.bio ? (
            <p className="text-ink/62 mt-4 max-w-2xl text-sm leading-6">
              {provider.bio}
            </p>
          ) : null}

          <form action={toggleProviderFavorite} className="mt-4">
            <input name="providerSlug" type="hidden" value={provider.public_slug} />
            <input name="returnTo" type="hidden" value={`/p/${provider.public_slug}`} />
            <input name="shouldFavorite" type="hidden" value={String(!isFavorite)} />
            <button className="button-secondary min-h-11" type="submit">
              {isFavorite ? "Quitar de guardados" : "Guardar proveedor"}
            </button>
          </form>
        </section>

        <div className="mt-6">
          <ProviderReputation providerSlug={provider.public_slug} />
        </div>

        <PublicSection title="Servicios">
          {(services ?? []).length ? (
            <div className="divide-y divide-ink/10">
              {(services ?? []).map((service) => (
                <Link
                  className="consumer-pressable flex min-h-[5.25rem] items-start gap-3 rounded-lg px-1 py-3 hover:bg-ink/[0.035]"
                  href={`/p/${slug}/${service.public_slug}`}
                  key={service.public_slug}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-ink/45 text-xs font-semibold">
                      {service.skill_name}
                    </p>
                    <h3 className="mt-0.5 line-clamp-2 text-base font-bold">
                      {service.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <StatusChip tone="neutral">
                        {getServiceModalityLabel(service.modality)}
                      </StatusChip>
                      {service.accepts_offers ? (
                        <StatusChip tone="brand">Acepta ofertas</StatusChip>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">
                      {formatServicePrice(
                        service.price_model,
                        service.price_amount,
                        service.currency_code,
                        service.price_unit,
                      )}
                    </p>
                    <span className="text-ink/25 mt-2 block text-xl" aria-hidden="true">
                      ›
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-ink/50 py-3 text-sm">No hay servicios publicados.</p>
          )}
        </PublicSection>

        {(skills ?? []).length ? (
          <PublicSection title="Habilidades">
            <div className="flex flex-wrap gap-2">
              {(skills ?? []).map((skill) => (
                <StatusChip tone="neutral" key={skill.skill_slug}>
                  {skill.skill_name}
                </StatusChip>
              ))}
            </div>
          </PublicSection>
        ) : null}

        {(areas ?? []).length ? (
          <PublicSection title="Zona de servicio">
            <div className="divide-y divide-ink/10">
              {(areas ?? []).map((area) => (
                <div className="flex min-h-12 items-center justify-between gap-4 py-2" key={`${area.label}-${area.radius_meters}`}>
                  <span className="text-sm font-semibold">{area.label}</span>
                  <span className="text-ink/48 text-xs">
                    Radio aprox. {area.radius_meters} m
                  </span>
                </div>
              ))}
            </div>
            <p className="text-ink/42 mt-2 text-xs">
              La dirección exacta y las coordenadas no se muestran públicamente.
            </p>
          </PublicSection>
        ) : null}

        {(portfolio ?? []).length ? (
          <PublicSection title="Portfolio">
            <div className="grid gap-3 sm:grid-cols-2">
              {(portfolio ?? []).map((item) => (
                <article className="border-ink/10 overflow-hidden rounded-xl border bg-surface" key={item.id}>
                  {item.media_path ? (
                    <Image
                      className="aspect-video w-full object-cover"
                      src={`/api/portfolio/${item.media_path
                        .split("/")
                        .map(encodeURIComponent)
                        .join("/")}`}
                      alt=""
                      width={640}
                      height={360}
                      unoptimized
                    />
                  ) : null}
                  <div className="p-3">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.description ? (
                      <p className="text-ink/55 mt-1 text-sm leading-5">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </PublicSection>
        ) : null}

        {(experiences ?? []).length ? (
          <PublicSection title="Experiencia">
            <div className="divide-y divide-ink/10">
              {(experiences ?? []).map((item) => (
                <div className="py-3" key={`${item.title}-${item.started_on}`}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-ink/48 mt-0.5 text-sm">
                    {item.organization ?? "Experiencia independiente"}
                  </p>
                  {item.description ? (
                    <p className="text-ink/58 mt-1 text-sm leading-6">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </PublicSection>
        ) : null}

        {(education ?? []).length || (certifications ?? []).length ? (
          <PublicSection title="Formación y credenciales">
            <div className="divide-y divide-ink/10">
              {(education ?? []).map((item) => (
                <div className="py-3" key={`${item.institution}-${item.started_on}`}>
                  <p className="text-sm font-semibold">{item.institution}</p>
                  <p className="text-ink/48 mt-0.5 text-sm">
                    {item.field_of_study ?? "Formación"}
                  </p>
                </div>
              ))}
              {(certifications ?? []).map((item) => (
                <div className="py-3" key={`${item.title}-${item.issued_on}`}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-ink/48 mt-0.5 text-sm">
                    {item.issuer ?? "Emisor no especificado"}
                  </p>
                </div>
              ))}
            </div>
          </PublicSection>
        ) : null}

        <footer className="text-ink/38 border-ink/10 mt-8 border-t py-6 text-center text-xs">
          Changas · información publicada por el proveedor
        </footer>
      </div>
    </main>
  );
}

function PublicSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-ink/10 mt-6 border-t pt-5">
      <h2 className="text-lg font-bold tracking-[-0.015em]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
