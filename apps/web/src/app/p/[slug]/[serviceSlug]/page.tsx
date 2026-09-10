import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { Avatar } from "@/components/ui/marketplace/avatar";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import { createClient } from "@/lib/supabase/server";
import { getServiceModalityLabel } from "@/lib/ui/service-modality";

import { startServiceConversation } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>;
}): Promise<Metadata> {
  const { slug, serviceSlug } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: provider }] = await Promise.all([
    supabase
      .from("public_provider_services")
      .select("public_slug, title, description, skill_name")
      .eq("provider_slug", slug)
      .eq("public_slug", serviceSlug)
      .maybeSingle(),
    supabase
      .from("public_provider_profiles")
      .select("public_slug, display_name")
      .eq("public_slug", slug)
      .maybeSingle(),
  ]);
  if (!service || !provider) return { title: "Servicio no encontrado" };
  const description = service.description;
  const canonical = "/p/" + provider.public_slug + "/" + service.public_slug;
  return {
    title: service.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: service.title + " · " + provider.display_name,
      description,
      type: "website",
      url: canonical,
    },
  };
}

export default async function PublicServicePage({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>;
}) {
  const { slug: providerSlug, serviceSlug } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: provider }, { data: tags }] =
    await Promise.all([
      supabase
        .from("public_provider_services")
        .select("*")
        .eq("provider_slug", providerSlug)
        .eq("public_slug", serviceSlug)
        .maybeSingle(),
      supabase
        .from("public_provider_profiles")
        .select("*")
        .eq("public_slug", providerSlug)
        .maybeSingle(),
      supabase
        .from("public_service_tags")
        .select("tag")
        .eq("provider_slug", providerSlug)
        .eq("service_public_slug", serviceSlug),
    ]);
  if (!service || !provider) notFound();

  const price = formatServicePrice(
    service.price_model,
    service.price_amount,
    service.currency_code,
    service.price_unit,
  );

  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen px-4 py-4 sm:px-8">
      <div className="mx-auto max-w-3xl">
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
            href={`/p/${providerSlug}`}
          >
            Ver perfil
          </Link>
        </header>

        <article className="consumer-card bg-surface mt-5 overflow-hidden p-4 pt-6 sm:mt-8 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="neutral">{service.skill_name}</StatusChip>
            <StatusChip tone="info">
              {getServiceModalityLabel(service.modality)}
            </StatusChip>
            {service.accepts_offers ? (
              <StatusChip tone="brand">Acepta ofertas</StatusChip>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">
            {service.title}
          </h1>
          <p className="text-ink/62 mt-3 text-sm leading-6 sm:text-base">
            {service.description}
          </p>

          <section className="border-ink/10 bg-surface-muted/55 mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-3 sm:px-3">
            <Metric label="Precio" value={price} />
            <Metric
              label="Duración"
              value={
                service.expected_duration_minutes
                  ? `${service.expected_duration_minutes} min`
                  : "A coordinar"
              }
            />
            <Metric
              label="Propuestas"
              value={service.accepts_offers ? "Acepta" : "No aplica"}
            />
          </section>

          <section className="border-ink/10 mt-6 border-t pt-5">
            <h2 className="text-lg font-bold">Detalles del servicio</h2>
            <div className="mt-2 divide-y divide-ink/10">
              <Info title="Incluye" value={service.includes} />
              <Info title="No incluye" value={service.excludes} />
              <Info title="Materiales y notas" value={service.materials_notes} />
            </div>
          </section>

          {(tags ?? []).length ? (
            <section className="border-ink/10 mt-6 border-t pt-5">
              <h2 className="text-lg font-bold">Relacionado</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(tags ?? []).map((tag) => (
                  <StatusChip tone="neutral" key={tag.tag}>
                    {tag.tag}
                  </StatusChip>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-ink/10 mt-6 border-t pt-5">
            <Link
              href={`/p/${providerSlug}`}
              className="consumer-pressable flex min-h-14 items-center gap-3 rounded-lg px-1 hover:bg-ink/[0.035]"
            >
              <Avatar
                name={provider.display_name}
                src={
                  isTrustedPublicAvatarUrl(provider.avatar_url)
                    ? provider.avatar_url
                    : null
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink/45">Ofrece</span>
                <span className="block truncate text-sm font-bold">
                  {provider.display_name}
                </span>
                {provider.public_headline ? (
                  <span className="text-ink/52 mt-0.5 block truncate text-sm">
                    {provider.public_headline}
                  </span>
                ) : null}
              </span>
              <span className="text-ink/25 text-xl" aria-hidden="true">
                ›
              </span>
            </Link>
          </section>

          <div className="bg-canvas/95 border-ink/10 sticky bottom-0 z-20 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
            <div className="flex items-center gap-3 sm:justify-between">
              <div className="hidden sm:block">
                <p className="text-sm font-bold">{price}</p>
                <p className="text-ink/48 text-xs">Consultá alcance y tiempos por chat.</p>
              </div>
              <form action={startServiceConversation} className="w-full sm:w-auto">
                <input type="hidden" name="providerSlug" value={providerSlug} />
                <input type="hidden" name="serviceSlug" value={serviceSlug} />
                <button className="button-primary w-full sm:w-auto" type="submit">
                  Consultar por este servicio
                </button>
              </form>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink/42 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function Info({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-ink/58 mt-1 text-sm leading-6">
        {value ?? "No especificado"}
      </p>
    </div>
  );
}
