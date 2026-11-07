import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { ActionArrowIcon } from "@/components/ui/marketplace/action-arrow-icon";
import { formatServicePrice } from "@changas/domain";

import { ProviderReputation } from "@/components/reputation/provider-reputation";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { AppHeader } from "@/components/ui/marketplace/app-header";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { isTrustedPublicAvatarUrl } from "@/lib/discovery/public-media";
import { toggleProviderFavorite } from "@/lib/favorites/actions";
import { createClient } from "@/lib/supabase/server";
import { getServiceModalityLabel } from "@/lib/ui/service-modality";
import { GuideHeader } from "@/components/ui/guided";
import { CLIENT_HIRE_STEPS } from "@/lib/ui/guided";
import { isExcludedPublicTestCategory } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

// cache(): generateMetadata y la page comparten un único roundtrip por request.
const getProvider = cache(async (slug: string) => {
  const supabase = await createClient();
  return supabase
    .from("public_provider_profiles")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { data: provider } = await getProvider(slug);
    if (!provider) return { title: "Proveedor no encontrado" };
    const description =
      provider.bio ??
      provider.public_headline ??
      "Servicios publicados en YALO.";
    return {
      title: provider.display_name,
      description,
      alternates: { canonical: "/p/" + provider.public_slug },
      openGraph: {
        title: provider.display_name + " · YALO",
        description,
        type: "profile",
        url: "/p/" + provider.public_slug,
      },
    };
  } catch {
    return { title: "Proveedor · YALO" };
  }
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
  const { data: provider } = await getProvider(slug);
  if (!provider) notFound();
  const supabase = await createClient();

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
    { data: rawServices },
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

  const services =
    process.env.NODE_ENV === "production"
      ? (rawServices ?? []).filter(
          (service) => !/\(\s*prueba\s*\)\s*$/i.test(service.title),
        )
      : rawServices;
  const publicSkills = (skills ?? []).filter(
    (skill) => !isExcludedPublicTestCategory({ slug: skill.category_slug }),
  );
  // "Habilidades" sólo suma si hay alguna que no aparece ya en un servicio.
  const serviceSkillNames = new Set(
    (services ?? []).map((service) => service.skill_name),
  );
  const extraSkills = publicSkills.filter(
    (skill) => !serviceSkillNames.has(skill.skill_name),
  );
  // Precio "desde": mínimo real entre los servicios publicados con monto.
  // Si ninguno tiene monto, se omite (nunca se inventa).
  const pricedServices = (services ?? []).filter(
    (service) => typeof service.price_amount === "number",
  );
  const cheapestPriced =
    pricedServices.length > 0
      ? pricedServices.reduce((a, b) =>
          (a.price_amount ?? 0) <= (b.price_amount ?? 0) ? a : b,
        )
      : null;
  const fromPrice = cheapestPriced
    ? formatServicePrice(
        cheapestPriced.price_model,
        cheapestPriced.price_amount,
        cheapestPriced.currency_code,
        cheapestPriced.price_unit,
      )
    : null;
  // Destino de la cotización: servicio único directo, si no al listado.
  const quoteHref =
    (services?.length ?? 0) === 1 && services?.[0]?.public_slug
      ? `/p/${slug}/${services?.[0]?.public_slug}`
      : `/p/${slug}#servicios`;

  return (
    <main
      id="main-content"
      className="yalo-ui bg-canvas text-ink min-h-screen px-4 pt-4 pb-28 sm:px-8 sm:pb-10"
    >
      <div className="mx-auto max-w-4xl">
        <AppHeader
          brand
          action={
            <Link
              className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
              href="/buscar"
            >
              Buscar servicios{" "}
              <span aria-hidden="true">
                <ActionArrowIcon />
              </span>
            </Link>
          }
          className="sm:flex"
        />

        <section className="pt-6 sm:pt-8">
          {pageSearchParams.favoriteError ? (
            <p
              className="bg-danger/[0.07] text-danger mb-4 rounded-xl px-3 py-2.5 text-sm"
              role="alert"
            >
              No pudimos actualizar el proveedor guardado. Intentá nuevamente.
            </p>
          ) : null}

          <div className="consumer-card bg-surface overflow-hidden">
            <div
              className="relative h-16 overflow-hidden sm:h-24"
              style={{ background: coverFor(provider.public_slug).css }}
              role="img"
              aria-label={`Portada ilustrada de ${provider.display_name}`}
            ></div>
            <div className="flex items-start gap-5 p-5 sm:p-7">
              {/* relative + z-10: el avatar se superpone completo al banner. */}
              <span className="relative z-10 -mt-12 sm:-mt-14">
                <span className="block rounded-full bg-white ring-4 ring-white dark:bg-[#1c1712] dark:ring-[#1c1712]">
                  <Avatar
                    name={provider.display_name}
                    src={
                      isTrustedPublicAvatarUrl(provider.avatar_url)
                        ? provider.avatar_url
                        : null
                    }
                    size="lg"
                  />
                </span>
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* public_provider_profiles solo expone prestadores con
                      status ACTIVE (identidad aprobada): existir acá ES la
                      verificación. Sin hardcodear nada. */}
                  <StatusChip tone="success">
                    <span title="Identidad verificada por YALO">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: "inline", verticalAlign: "-2px" }}
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>{" "}
                      Verificado
                    </span>
                  </StatusChip>
                  {provider.public_zone ? (
                    <span className="text-ink/70 text-[13px] font-medium">
                      {provider.public_zone}
                    </span>
                  ) : null}
                </div>
                <h1 className="font-display mt-3 text-[26px] leading-8 font-semibold tracking-[-0.03em]">
                  {provider.display_name}
                </h1>
                {provider.public_headline ? (
                  <p className="text-ink/70 mt-1.5 text-[15px] leading-6 font-semibold">
                    {provider.public_headline}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <GuideHeader
            step={2}
            steps={CLIENT_HIRE_STEPS}
            variant="inline"
            className="text-ink mt-4"
          />

          {(services?.length ?? 0) > 0 ? (
            <div className="service-cta-bar service-cta-bar-flush bg-canvas/95 border-ink/[0.08] fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
              <div className="mx-auto flex max-w-4xl items-center gap-3">
                <form action={toggleProviderFavorite} className="shrink-0">
                  <input
                    name="providerSlug"
                    type="hidden"
                    value={provider.public_slug}
                  />
                  <input
                    name="returnTo"
                    type="hidden"
                    value={`/p/${provider.public_slug}`}
                  />
                  <input
                    name="shouldFavorite"
                    type="hidden"
                    value={String(!isFavorite)}
                  />
                  <button
                    className="consumer-pressable border-ink/[0.1] grid h-[52px] w-[52px] place-items-center rounded-2xl border bg-white dark:bg-white/[0.07]"
                    type="submit"
                    aria-label={
                      isFavorite ? "Quitar de guardados" : "Guardar proveedor"
                    }
                    aria-pressed={isFavorite}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className={`h-6 w-6 ${isFavorite ? "heart-pop fill-danger stroke-danger" : "stroke-ink fill-none"}`}
                      strokeWidth="1.8"
                    >
                      <path
                        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  {fromPrice ? (
                    <p className="truncate text-sm leading-5">
                      <span className="text-ink/70 font-medium">desde </span>
                      <strong className="text-[15px] font-semibold">
                        {fromPrice}
                      </strong>{" "}
                      <span className="text-ink/70 text-xs">
                        · se confirma por chat
                      </span>
                    </p>
                  ) : null}
                  <Link
                    href={quoteHref}
                    className="consumer-pressable cta-ink mt-1 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-5 text-[15px] font-semibold shadow-[0_6px_16px_rgba(255,107,53,0.22)]"
                  >
                    Pedir cotización
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {provider.bio ? (
            <p className="text-ink/70 mt-5 max-w-2xl text-sm leading-7">
              {provider.bio}
            </p>
          ) : null}

          <div className="mt-8">
            <ProviderReputation providerSlug={provider.public_slug} />
          </div>
          {/* Una sola garantía (antes: tres tarjetas + nota al pie). Sólo lo
              que la app ya hace: identidad aprobada, acuerdo por chat, pago
              directo y acompañamiento. */}
          <div className="profile-guarantee border-moss/25 bg-surface-muted consumer-card mt-5 flex items-start gap-4 rounded-2xl border p-4 sm:p-5">
            <IllustratedBadge
              tone="green"
              icon="shield"
              size="md"
              label="Identidad verificada y sin pago por adelantado"
            />
            <div>
              <p className="text-sm font-semibold">
                Identidad verificada · sin pago por adelantado
              </p>
              <p className="text-ink/70 mt-1 text-xs leading-6">
                El precio se acuerda por chat y pagás directo al prestador. Si
                algo sale mal, YALO te acompaña y la reseña queda pública.
              </p>
            </div>
          </div>

          <div className="mt-5 hidden gap-3 sm:flex">
            <form action={toggleProviderFavorite} className="flex-1">
              <input
                name="providerSlug"
                type="hidden"
                value={provider.public_slug}
              />
              <input
                name="returnTo"
                type="hidden"
                value={`/p/${provider.public_slug}`}
              />
              <input
                name="shouldFavorite"
                type="hidden"
                value={String(!isFavorite)}
              />
              <button
                className="button-secondary min-h-12 w-full"
                type="submit"
              >
                {isFavorite ? "Quitar de guardados" : "Guardar proveedor"}
              </button>
            </form>
            {(services?.length ?? 0) > 0 ? (
              <div className="flex-1">
                {fromPrice ? (
                  <p className="mb-1 text-sm leading-5">
                    <span className="text-ink/70 font-medium">desde </span>
                    <strong className="text-[15px] font-semibold">
                      {fromPrice}
                    </strong>{" "}
                    <span className="text-ink/70 text-xs">
                      · se confirma por chat
                    </span>
                  </p>
                ) : null}
                <Link
                  href={quoteHref}
                  className="consumer-pressable cta-ink inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-md"
                >
                  Pedir cotización
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <PublicSection
          title="Servicios"
          badge={{ tone: "orange", icon: "tag" }}
          id="servicios"
        >
          {(services ?? []).length ? (
            <div className="grid gap-3">
              {(services ?? []).map((service) => (
                <Link
                  className="consumer-card consumer-pressable bg-surface group flex min-h-[5.25rem] items-start gap-4 p-4 transition-colors duration-200"
                  href={`/p/${slug}/${service.public_slug}`}
                  key={service.public_slug}
                >
                  <span
                    className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-semibold text-white shadow-[0_8px_20px_-8px_rgb(23_20_15/35%)] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/70%)]"
                    style={{
                      backgroundImage: coverFor(service.public_slug).css,
                    }}
                    aria-hidden="true"
                  >
                    <span className="relative">
                      {service.title.trim().charAt(0).toUpperCase() || "C"}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink/70 text-[13px] font-semibold">
                      {service.skill_name}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-[15px] leading-6 font-bold">
                      {service.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusChip tone="neutral">
                        {getServiceModalityLabel(service.modality)}
                      </StatusChip>
                      {service.accepts_offers ? (
                        <StatusChip tone="brand">Acepta ofertas</StatusChip>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <p className="text-[15px] font-semibold">
                      {formatServicePrice(
                        service.price_model,
                        service.price_amount,
                        service.currency_code,
                        service.price_unit,
                      )}
                    </p>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="text-ink/70 h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                    >
                      <path
                        d="m9 5 7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-ink/70 py-3 text-sm">
              No hay servicios publicados.
            </p>
          )}
        </PublicSection>

        {extraSkills.length ? (
          <PublicSection
            title="Habilidades"
            badge={{ tone: "blue", icon: "tag" }}
          >
            <div className="flex flex-wrap gap-2">
              {extraSkills.map((skill) => (
                <StatusChip tone="neutral" key={skill.skill_slug}>
                  {skill.skill_name}
                </StatusChip>
              ))}
            </div>
          </PublicSection>
        ) : null}

        {(areas ?? []).length ? (
          <PublicSection
            title="Zona de servicio"
            badge={{ tone: "blue", icon: "pin" }}
          >
            <div className="grid gap-2">
              {(areas ?? []).map((area) => (
                <div
                  className="border-ink/[0.08] bg-surface consumer-card flex min-h-12 items-center justify-between gap-4 rounded-2xl border px-4 py-3"
                  key={`${area.label}-${area.radius_meters}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <IllustratedBadge
                      tone="blue"
                      icon="pin"
                      size="sm"
                      label="Zona de servicio"
                    />
                    <span className="truncate text-sm font-semibold">
                      {area.label}
                    </span>
                  </span>
                  <span className="text-ink/70 shrink-0 text-xs">
                    Radio aprox. {area.radius_meters} m
                  </span>
                </div>
              ))}
            </div>
            <p className="text-ink/42 mt-3 text-xs leading-5">
              La dirección exacta y las coordenadas no se muestran públicamente.
            </p>
          </PublicSection>
        ) : null}

        {(portfolio ?? []).length ? (
          <PublicSection
            title="Portfolio"
            badge={{ tone: "violet", icon: "tag" }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(portfolio ?? []).map((item) => (
                <article
                  className="border-ink/[0.08] bg-surface consumer-card group overflow-hidden rounded-2xl border transition-colors duration-200"
                  key={item.id}
                >
                  {item.media_path ? (
                    <Image
                      className="aspect-video w-full object-cover"
                      src={`/api/portfolio/${item.media_path
                        .split("/")
                        .map(encodeURIComponent)
                        .join("/")}`}
                      alt={`Trabajo real: ${item.title}`}
                      width={640}
                      height={360}
                      sizes="(max-width: 640px) 100vw, 640px"
                    />
                  ) : null}
                  <div className="p-4">
                    <p className="text-sm leading-5 font-semibold">
                      {item.title}
                    </p>
                    {item.description ? (
                      <p className="text-ink/70 mt-1.5 text-sm leading-6">
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
          <PublicSection
            title="Experiencia"
            badge={{ tone: "violet", icon: "briefcase" }}
          >
            <div className="grid gap-2">
              {(experiences ?? []).map((item) => (
                <div
                  className="border-ink/[0.08] bg-surface consumer-card flex items-start gap-3 rounded-2xl border px-4 py-3.5"
                  key={`${item.title}-${item.started_on}`}
                >
                  <IllustratedBadge
                    tone="violet"
                    icon="briefcase"
                    size="sm"
                    label="Experiencia laboral"
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-semibold">
                      {item.title}
                    </p>
                    <p className="text-ink/70 mt-1 text-sm leading-5">
                      {item.organization ?? "Experiencia independiente"}
                    </p>
                    {item.description ? (
                      <p className="text-ink/70 mt-1.5 text-sm leading-7">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </PublicSection>
        ) : null}

        {(education ?? []).length || (certifications ?? []).length ? (
          <PublicSection
            title="Formación y credenciales"
            badge={{ tone: "gold", icon: "star" }}
          >
            <div className="grid gap-2">
              {(education ?? []).map((item) => (
                <div
                  className="border-ink/[0.08] bg-surface consumer-card flex items-start gap-3 rounded-2xl border px-4 py-3.5"
                  key={`${item.institution}-${item.started_on}`}
                >
                  <IllustratedBadge
                    tone="gold"
                    icon="star"
                    size="sm"
                    label="Formación"
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-semibold">
                      {item.institution}
                    </p>
                    <p className="text-ink/70 mt-1 text-sm leading-5">
                      {item.field_of_study ?? "Formación"}
                    </p>
                  </div>
                </div>
              ))}
              {(certifications ?? []).map((item) => (
                <div
                  className="border-ink/[0.08] bg-surface consumer-card flex items-start gap-3 rounded-2xl border px-4 py-3.5"
                  key={`${item.title}-${item.issued_on}`}
                >
                  <IllustratedBadge
                    tone="green"
                    icon="shield"
                    size="sm"
                    label="Certificación"
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-semibold">
                      {item.title}
                    </p>
                    <p className="text-ink/70 mt-1 text-sm leading-5">
                      {item.issuer ?? "Emisor no especificado"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </PublicSection>
        ) : null}

        <footer className="border-ink/10 mt-10 border-t py-6 text-center">
          <p className="text-ink/38 text-xs leading-5">
            YALO · información publicada por el proveedor
          </p>
        </footer>
      </div>
    </main>
  );
}

function PublicSection({
  title,
  badge,
  children,
  id,
}: {
  title: string;
  badge: {
    tone: "orange" | "blue" | "green" | "rose" | "violet" | "gold" | "neutral";
    icon: "tag" | "sparkle" | "pin" | "briefcase" | "star" | "shield" | "check";
    label?: string;
  };
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="profile-section-card consumer-card bg-surface mt-6 scroll-mt-24 p-5 sm:p-6"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <IllustratedBadge
          tone={badge.tone}
          icon={badge.icon}
          size="sm"
          label={badge.label ?? title}
        />
        <h2 className="font-display truncate text-lg leading-7 font-bold tracking-[-0.015em]">
          {title}
        </h2>
      </span>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const PROFILE_COVERS = [
  { css: "#22354A", tone: "orange" },
  { css: "#164F6B", tone: "blue" },
  { css: "#185253", tone: "green" },
  { css: "#235346", tone: "rose" },
  { css: "#28455C", tone: "violet" },
  { css: "#1B4D57", tone: "gold" },
] as const;

function coverFor(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1)
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return PROFILE_COVERS[hash % PROFILE_COVERS.length] ?? PROFILE_COVERS[0];
}
