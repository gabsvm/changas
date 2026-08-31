import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { createClient } from "@/lib/supabase/server";

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
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
    >
      <div className="mx-auto max-w-4xl">
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
          <Link
            className="text-ink/60 text-sm underline underline-offset-4"
            href={`/p/${providerSlug}`}
          >
            ← Ver perfil
          </Link>
        </header>
        <article className="border-ink/10 mt-10 rounded-[2rem] border bg-white/70 p-7 shadow-[0_24px_80px_rgba(22,56,50,0.08)] sm:p-10">
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            {service.skill_name} · {service.modality}
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            {service.title}
          </h1>
          <p className="text-ink/65 mt-6 max-w-3xl text-base leading-8">
            {service.description}
          </p>
          <div className="border-ink/10 mt-8 grid gap-4 border-y py-6 sm:grid-cols-3">
            <div>
              <p className="text-ink/50 text-xs uppercase">Precio</p>
              <p className="mt-1 text-lg font-semibold">
                {formatServicePrice(
                  service.price_model,
                  service.price_amount,
                  service.currency_code,
                  service.price_unit,
                )}
              </p>
            </div>
            <div>
              <p className="text-ink/50 text-xs uppercase">Duración</p>
              <p className="mt-1 text-lg font-semibold">
                {service.expected_duration_minutes
                  ? `${service.expected_duration_minutes} min`
                  : "A coordinar"}
              </p>
            </div>
            <div>
              <p className="text-ink/50 text-xs uppercase">Propuestas</p>
              <p className="mt-1 text-lg font-semibold">
                {service.accepts_offers ? "Acepta" : "No aplica"}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Info title="Incluye" value={service.includes} />
            <Info title="No incluye" value={service.excludes} />
            <Info title="Materiales y notas" value={service.materials_notes} />
          </div>
          {(tags ?? []).length ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {(tags ?? []).map((tag) => (
                <span
                  className="border-ink/10 rounded-full border px-3 py-2 text-xs"
                  key={tag.tag}
                >
                  {tag.tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="bg-moss/10 mt-10 rounded-2xl p-5">
            <p className="text-moss text-sm font-semibold">
              Ofrece {provider.display_name}
            </p>
            <p className="text-ink/65 mt-1 text-sm">
              Contactá al proveedor desde los canales que Changas habilite en
              las próximas fases.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

function Info({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-ink/65 mt-2 text-sm leading-6">
        {value ?? "No especificado"}
      </p>
    </div>
  );
}
