import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { ConsumerShell } from "@/components/ui/consumer-shell";
import { createClient } from "@/lib/supabase/server";
import { getModalityLabel } from "@/lib/ui/marketplace-labels";

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

  return (
    <ConsumerShell maxWidth="max-w-4xl">
      <nav className="pt-6" aria-label="Contexto del servicio">
        <Link
          className="text-moss hover:bg-moss/5 inline-flex min-h-12 items-center rounded-xl px-2 text-sm font-bold"
          href={`/p/${providerSlug}`}
        >
          ← Ver perfil de {provider.display_name}
        </Link>
      </nav>

      <article className="border-ink/10 bg-surface mt-3 rounded-[1.75rem] border p-5 shadow-[0_18px_50px_rgba(32,33,36,0.06)] sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-brand-yellow/18 text-warning rounded-full px-3 py-1.5 text-xs font-extrabold">
            {service.skill_name}
          </span>
          <span className="bg-moss/8 text-moss rounded-full px-3 py-1.5 text-xs font-extrabold">
            {getModalityLabel(service.modality)}
          </span>
        </div>

        <h1 className="product-page-title mt-4">{service.title}</h1>

        <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-ink/45 text-xs font-bold uppercase">Precio</p>
            <p className="mt-1 text-2xl font-extrabold tracking-[-0.025em]">
              {formatServicePrice(
                service.price_model,
                service.price_amount,
                service.currency_code,
                service.price_unit,
              )}
            </p>
          </div>
          <Link
            href={`/p/${providerSlug}`}
            className="text-moss mt-3 text-sm font-bold underline underline-offset-4 sm:mt-0"
          >
            Por {provider.display_name}
          </Link>
        </div>

        <p className="text-ink/68 mt-6 max-w-3xl text-base leading-7">
          {service.description}
        </p>

        <section className="border-ink/10 mt-7 grid gap-4 border-y py-5 sm:grid-cols-2">
          <div>
            <p className="text-ink/45 text-xs font-bold uppercase">Duración</p>
            <p className="mt-1 font-bold">
              {service.expected_duration_minutes
                ? `${service.expected_duration_minutes} min aprox.`
                : "A coordinar"}
            </p>
          </div>
          <div>
            <p className="text-ink/45 text-xs font-bold uppercase">Ofertas</p>
            <p className="mt-1 font-bold">
              {service.accepts_offers ? "Acepta propuestas" : "Precio publicado"}
            </p>
          </div>
        </section>

        <section className="mt-7 grid gap-5 sm:grid-cols-3">
          <Info title="Incluye" value={service.includes} />
          <Info title="No incluye" value={service.excludes} />
          <Info title="Materiales y notas" value={service.materials_notes} />
        </section>

        {(tags ?? []).length ? (
          <div className="mt-7 flex flex-wrap gap-2" aria-label="Etiquetas">
            {(tags ?? []).map((tag) => (
              <span
                className="border-ink/10 bg-white/70 rounded-full border px-3 py-2 text-xs font-semibold"
                key={tag.tag}
              >
                {tag.tag}
              </span>
            ))}
          </div>
        ) : null}

        <section className="bg-brand-orange/10 border-brand-orange/15 mt-8 rounded-2xl border p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="font-extrabold">¿Te sirve este servicio?</p>
            <p className="text-ink/65 mt-1 max-w-xl text-sm leading-6">
              Consultá alcance, tiempos y dudas dentro de Changas antes de avanzar.
            </p>
          </div>
          <form action={startServiceConversation} className="mt-4 shrink-0 sm:mt-0">
            <input type="hidden" name="providerSlug" value={providerSlug} />
            <input type="hidden" name="serviceSlug" value={serviceSlug} />
            <button className="button-primary w-full sm:w-auto" type="submit">
              Consultar
            </button>
          </form>
        </section>
      </article>
    </ConsumerShell>
  );
}

function Info({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <h2 className="text-base font-extrabold">{title}</h2>
      <p className="text-ink/65 mt-2 text-sm leading-6">
        {value ?? "No especificado"}
      </p>
    </div>
  );
}
