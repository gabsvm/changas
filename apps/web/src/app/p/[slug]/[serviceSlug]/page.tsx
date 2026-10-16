import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatServicePrice } from "@changas/domain";

import { ConsultButton } from "@/components/service/consult-button";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { AppHeader } from "@/components/ui/marketplace/app-header";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import { createClient } from "@/lib/supabase/server";
import { getServiceModalityLabel } from "@/lib/ui/service-modality";
import { GuideHeader } from "@/components/ui/guided";
import {
  getServiceHireKind,
  isInstantBookingEligible,
} from "@/lib/ui/direct-booking";
import { CLIENT_HIRE_STEPS } from "@/lib/ui/guided";

import { startServiceConversation } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>;
}): Promise<Metadata> {
  try {
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
  } catch {
    return { title: "Servicio · YALO" };
  }
}

const CONSULT_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "No tenés permiso para consultar por este servicio.",
  NOT_FOUND: "Este servicio ya no está disponible.",
  CONFLICT:
    "No podés contactarte con vos mismo. Si el servicio no es tuyo, es probable que ya no esté disponible.",
};

export default async function PublicServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug: providerSlug, serviceSlug } = await params;
  const query = await searchParams;
  const rawError = query.consultError;
  const consultErrorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const consultErrorMessage = consultErrorCode
    ? (CONSULT_ERROR_MESSAGES[consultErrorCode] ??
      "Ocurrió un problema temporal. Probá de nuevo.")
    : null;
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

  const hireKind = getServiceHireKind(service);
  const instantEligible = isInstantBookingEligible(service);
  const hireCtaLabel = instantEligible
    ? "Consultar disponibilidad y reservar"
    : service.price_model === "FIXED" && service.price_amount !== null
      ? "Pedir cotización"
      : "Pedir presupuesto";
  return (
    <main
      id="main-content"
      className="yalo-ui bg-canvas text-ink min-h-screen px-4 pt-4 pb-28 sm:px-8 sm:pb-10"
    >
      <div className="mx-auto max-w-3xl">
        {consultErrorMessage ? (
          <div
            role="alert"
            className="border-danger/25 bg-danger/[0.06] mb-4 rounded-2xl border px-4 py-3"
          >
            <p className="text-sm font-extrabold">No pudimos abrir el chat</p>
            <p className="text-ink/70 mt-0.5 text-sm">{consultErrorMessage}</p>
          </div>
        ) : null}
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

        <section
          className="service-hire-top mt-4 rounded-[1.5rem] border border-[#12D9C5]/30 bg-[#132638] px-5 py-5 shadow-[0_16px_40px_rgb(0_0_0/17%)] sm:px-6 sm:py-6"
          aria-label="Cotización y contratación"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.13em] text-[#83EADA] uppercase">
                Servicio de {provider.display_name}
              </p>
              <h1 className="font-display mt-2 text-[23px] leading-tight font-extrabold tracking-[-0.035em] text-white sm:text-3xl">
                {service.title}
              </h1>
              <p className="mt-2 text-[22px] font-extrabold text-[#9DF6DB]">
                {price}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#B7C9D8]">
                {instantEligible
                  ? "Consultá disponibilidad y coordiná la reserva."
                  : "Conversá con el prestador y acordá los detalles antes de contratar."}
              </p>
            </div>
            <form
              action={startServiceConversation}
              className="w-full shrink-0 sm:w-auto sm:min-w-[260px]"
            >
              <input type="hidden" name="providerSlug" value={providerSlug} />
              <input type="hidden" name="serviceSlug" value={serviceSlug} />
              <input type="hidden" name="hireKind" value={hireKind} />
              <div className="[&_button]:w-full">
                <ConsultButton label={hireCtaLabel} />
              </div>
            </form>
          </div>
        </section>

        <GuideHeader step={2} steps={CLIENT_HIRE_STEPS} className="mt-5" />

        <article className="service-hero-card consumer-card bg-surface mt-5 overflow-hidden sm:mt-8">
          <div
            className="relative flex min-h-44 items-end overflow-hidden p-5 sm:min-h-52 sm:p-8"
            style={{ backgroundImage: coverFor(serviceSlug).css }}
            role="img"
            aria-label={`Portada ilustrada de ${service.title}`}
          >
            <span
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "12px 12px",
              }}
              aria-hidden="true"
            />
            <span
              className="absolute -right-10 -bottom-12 h-40 w-40 rounded-full bg-white/20"
              aria-hidden="true"
            />
            <span
              className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-white/15"
              aria-hidden="true"
            />
            <span className="relative flex flex-wrap items-center gap-1.5">
              <IllustratedBadge
                tone={coverFor(serviceSlug).tone}
                icon="tag"
                size="lg"
                label={service.skill_name}
              />
            </span>
          </div>
          <div className="p-5 sm:p-8 sm:pt-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone="info">
                {getServiceModalityLabel(service.modality)}
              </StatusChip>
              {service.accepts_offers ? (
                <StatusChip tone="brand">Acepta ofertas</StatusChip>
              ) : null}
            </div>

            <p className="text-ink/70 mt-3 max-w-2xl text-[15px] leading-7 sm:text-base">
              {service.description}
            </p>

            <section
              className="service-price-panel border-ink/[0.08] bg-surface consumer-card mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border px-5 py-5 shadow-[0_2px_4px_rgb(23_20_15/5%),0_16px_36px_-10px_rgb(23_20_15/20%)] sm:grid-cols-3 dark:shadow-[0_16px_36px_-10px_rgb(0_0_0/70%)]"
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
                className="border-ink/[0.08] bg-surface consumer-card mt-4 rounded-2xl border px-5 py-4 text-sm shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:bg-white/[0.05] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
                aria-label="Desglose del precio"
              >
                {service.price_model === "FIXED" ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink/70 text-[13px] font-semibold">
                        Subtotal del servicio
                      </span>
                      <span className="font-bold">{price}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="text-ink/70 text-[13px] font-semibold">
                        Comisión de YALO
                      </span>
                      <span className="text-moss text-[13px] font-bold">
                        Sin cobro online
                      </span>
                    </div>
                    <div className="border-ink/[0.08] mt-2 flex items-center justify-between gap-3 border-t pt-2">
                      <span className="text-[13px] font-extrabold">
                        Total a pagar
                      </span>
                      <span className="text-[15px] font-extrabold">
                        {price}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-extrabold">
                      Precio de referencia
                    </span>
                    <span className="text-[15px] font-extrabold">{price}</span>
                  </div>
                )}
                <p className="text-ink/70 mt-2 text-xs leading-5">
                  {service.price_model === "FIXED"
                    ? "Acordás el precio al contratar. El pago se realiza directamente entre las partes; YALO permite registrar lo declarado."
                    : "Precio de referencia — el total se acuerda en la propuesta. El pago se realiza directamente entre las partes."}
                </p>
              </section>
            ) : null}

            <section className="border-ink/[0.08] bg-surface consumer-card mt-8 rounded-2xl border p-5 sm:p-6">
              <span className="flex min-w-0 items-center gap-2.5">
                <IllustratedBadge
                  tone="blue"
                  icon="doc"
                  size="sm"
                  label="Detalles del servicio"
                />
                <h2 className="font-display text-lg leading-7 font-bold">
                  Detalles del servicio
                </h2>
              </span>
              <div className="mt-4 grid gap-2">
                <Info title="Incluye" value={service.includes} />
                <Info title="No incluye" value={service.excludes} />
                <Info
                  title="Materiales y notas"
                  value={service.materials_notes}
                />
              </div>
            </section>

            {(tags ?? []).length ? (
              <section className="border-ink/[0.08] bg-surface consumer-card mt-4 rounded-2xl border p-5 sm:p-6">
                <span className="flex min-w-0 items-center gap-2.5">
                  <IllustratedBadge
                    tone="violet"
                    icon="tag"
                    size="sm"
                    label="Relacionado"
                  />
                  <h2 className="font-display text-lg leading-7 font-bold">
                    Relacionado
                  </h2>
                </span>
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
                className="consumer-card consumer-pressable bg-surface border-ink/[0.08] flex min-h-14 items-center gap-4 rounded-2xl border p-3 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(23_20_15/5%),0_16px_36px_-10px_rgb(23_20_15/20%)]"
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

            <div className="border-moss/25 bg-moss/[0.07] consumer-card mt-8 flex items-start gap-3.5 rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
              <IllustratedBadge
                tone="green"
                icon="shield"
                size="md"
                label="Garantía YALO"
              />
              <div>
                <p className="text-sm font-extrabold">
                  Sin pago por adelantado + soporte
                </p>
                <p className="text-ink/70 mt-1 text-xs leading-6">
                  Sin pago por adelantado: coordinás por chat y el pago se hace
                  directamente entre las partes. Si algo sale mal, el equipo de
                  YALO te acompaña.
                </p>
              </div>
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
    <div className="border-ink/[0.08] bg-surface consumer-card rounded-2xl border px-4 py-3.5">
      <h3 className="text-sm leading-5 font-bold">{title}</h3>
      <p className="text-ink/70 mt-1.5 text-sm leading-7">{value}</p>
    </div>
  );
}

const SERVICE_COVERS = [
  { css: "linear-gradient(135deg, #22354A 0%, #0D121B 100%)", tone: "orange" },
  { css: "linear-gradient(135deg, #164F6B 0%, #112033 100%)", tone: "blue" },
  { css: "linear-gradient(135deg, #185253 0%, #10282F 100%)", tone: "green" },
  { css: "linear-gradient(135deg, #235346 0%, #12282E 100%)", tone: "rose" },
  { css: "linear-gradient(135deg, #28455C 0%, #121E2C 100%)", tone: "violet" },
  { css: "linear-gradient(135deg, #1B4D57 0%, #10222D 100%)", tone: "gold" },
] as const;

function coverFor(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1)
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return SERVICE_COVERS[hash % SERVICE_COVERS.length] ?? SERVICE_COVERS[0];
}
