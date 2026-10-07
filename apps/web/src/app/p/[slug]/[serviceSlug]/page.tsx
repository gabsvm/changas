import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { ConsultButton } from "@/components/service/consult-button";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { AppHeader } from "@/components/ui/marketplace/app-header";
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
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-4 pt-4 pb-28 sm:px-8 sm:pb-10"
    >
      <div className="mx-auto max-w-3xl">
        <AppHeader
          brand
          action={
            <Link
              className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
              href={`/p/${providerSlug}`}
            >
              Ver perfil <span aria-hidden="true">→</span>
            </Link>
          }
          className="sm:flex"
        />

        <article className="service-hero-card consumer-card bg-surface mt-5 overflow-hidden p-5 sm:mt-8 sm:p-8">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone="neutral">{service.skill_name}</StatusChip>
            <StatusChip tone="info">
              {getServiceModalityLabel(service.modality)}
            </StatusChip>
            {service.accepts_offers ? (
              <StatusChip tone="brand">Acepta ofertas</StatusChip>
            ) : null}
          </div>

          <h1 className="mt-4 text-[24px] leading-8 font-extrabold tracking-[-0.03em] sm:text-4xl sm:leading-10">
            {service.title}
          </h1>
          <p className="text-ink/70 mt-3 max-w-2xl text-[15px] leading-7 sm:text-base">
            {service.description}
          </p>

          <section
            className="service-price-panel border-ink/[0.08] bg-surface-muted/70 mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border px-5 py-5 sm:grid-cols-3"
            aria-label="Precio y condiciones"
          >
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
              value={service.accepts_offers ? "Acepta" : "Precio fijo"}
            />
          </section>

          {service.price_amount !== null ? (
            <section
              className="border-ink/[0.08] mt-4 rounded-2xl border bg-white/70 px-5 py-4 text-sm dark:bg-white/[0.05]"
              aria-label="Desglose del precio"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink/70 text-[13px] font-semibold">
                  Subtotal del servicio
                </span>
                <span className="font-bold">{price}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-ink/70 text-[13px] font-semibold">
                  Comisión de Changas
                </span>
                <span className="text-moss text-[13px] font-bold">
                  Incluida en el total
                </span>
              </div>
              <div className="border-ink/[0.08] mt-2 flex items-center justify-between gap-3 border-t pt-2">
                <span className="text-[13px] font-extrabold">Total a pagar</span>
                <span className="text-[15px] font-extrabold">{price}</span>
              </div>
              <p className="text-ink/70 mt-2 text-xs leading-5">
                La comisión se descuenta antes de liberarle el pago al
                proveedor. Nada extra al precio publicado.
              </p>
            </section>
          ) : null}


          <section className="border-ink/10 mt-8 border-t pt-6">
            <h2 className="text-lg leading-7 font-bold">
              Detalles del servicio
            </h2>
            <div className="divide-ink/10 mt-3 divide-y">
              <Info title="Incluye" value={service.includes} />
              <Info title="No incluye" value={service.excludes} />
              <Info
                title="Materiales y notas"
                value={service.materials_notes}
              />
            </div>
          </section>

          {(tags ?? []).length ? (
            <section className="border-ink/10 mt-8 border-t pt-6">
              <h2 className="text-lg leading-7 font-bold">Relacionado</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(tags ?? []).map((tag) => (
                  <StatusChip tone="neutral" key={tag.tag}>
                    {tag.tag}
                  </StatusChip>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-ink/10 mt-8 border-t pt-6">
            <Link
              href={`/p/${providerSlug}`}
              className="consumer-pressable hover:bg-ink/[0.035] flex min-h-14 items-center gap-4 rounded-lg px-2"
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
                <span className="text-ink/70 block text-xs font-semibold">
                  Ofrece
                </span>
                <span className="block truncate text-sm font-bold">
                  {provider.display_name}
                </span>
                {provider.public_headline ? (
                  <span className="text-ink/70 mt-0.5 block truncate text-sm">
                    {provider.public_headline}
                  </span>
                ) : null}
              </span>
              <span className="text-ink/25 text-xl" aria-hidden="true">
                ›
              </span>
            </Link>
          </section>

          <div className="border-moss/25 bg-moss/5 mt-8 flex items-start gap-3.5 rounded-2xl border p-4">
            <span
              className="bg-moss/10 text-moss grid h-9 w-9 shrink-0 place-items-center rounded-full text-base"
              aria-hidden="true"
            >
              ✓
            </span>
            <div>
              <p className="text-sm font-extrabold">
                Pagos retenidos hasta la entrega + soporte
              </p>
              <p className="text-ink/70 mt-1 text-xs leading-6">
                Tu pago queda retenido hasta que confirmás que el trabajo está
                listo. Si algo sale mal, el equipo de Changas te acompaña.
              </p>
            </div>
          </div>
          <div className="service-cta-bar service-cta-bar-no-nav bg-canvas/95 border-ink/[0.08] fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:static sm:mx-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="mx-auto flex max-w-3xl items-stretch gap-3 sm:items-center sm:justify-between">
              <div className="bg-surface border-ink/[0.08] hidden min-w-40 flex-col justify-center rounded-2xl border px-4 py-2 sm:flex">
                <p className="text-[15px] leading-5 font-extrabold">{price}</p>
                <p className="text-ink/70 text-xs">
                  Alcance y tiempos por chat
                </p>
              </div>
              <form
                action={startServiceConversation}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <input type="hidden" name="providerSlug" value={providerSlug} />
                <input type="hidden" name="serviceSlug" value={serviceSlug} />
                <div className="bg-surface border-ink/[0.08] flex min-w-0 flex-1 flex-col justify-center rounded-2xl border px-4 py-2 sm:hidden">
                  <p className="truncate text-[15px] leading-5 font-extrabold">
                    {price}
                  </p>
                  <p className="text-ink/70 truncate text-xs">
                    Por chat · responde rápido
                  </p>
                </div>
                <ConsultButton />
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
      <p className="text-ink/70 text-xs leading-5 font-bold tracking-[0.06em] uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] leading-6 font-extrabold">{value}</p>
    </div>
  );
}

function Info({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="py-4">
      <h3 className="text-sm leading-5 font-bold">{title}</h3>
      <p className="text-ink/70 mt-1.5 text-sm leading-7">{value}</p>
    </div>
  );
}
