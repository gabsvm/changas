import { redirect } from "next/navigation";

import { formatMinorUnits } from "@changas/domain";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import {
  ActionButton,
  ActionLink,
} from "@/components/ui/marketplace/action-button";
import {
  FormField,
  marketplaceInputClass,
} from "@/components/ui/marketplace/form-field";
import { createClient } from "@/lib/supabase/server";
import {
  countPostOffers,
  getJobPost,
  JobPostServerError,
} from "@/lib/jobs/job-posts-server";
import { governNeedAction, offerOnNeedAction } from "../actions";

export const metadata = {
  title: "Necesidad | YALO",
};

const STATUS_LABELS = {
  OPEN: "Abierta",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  HIRED: "Contratada",
} as const;

function scheduleLabel(start: string | null, end: string | null): string {
  const format = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (start && end)
    return `${format.format(new Date(start))} → ${format.format(new Date(end))}`;
  if (start) return `Desde ${format.format(new Date(start))}`;
  return "A coordinar";
}

export default async function NeedDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/needs/${postId}`);

  let post;
  try {
    post = await getJobPost(postId);
  } catch (error) {
    if (error instanceof JobPostServerError && error.code === "NOT_FOUND") {
      redirect("/needs");
    }
    throw error;
  }

  const isOwner = post.owner_user_id === user.id;

  const offerCount = isOwner ? await countPostOffers(postId) : 0;

  const { data: myServices } = isOwner
    ? { data: null }
    : await supabase
        .from("services")
        .select("id, title")
        .eq("provider_user_id", user.id)
        .eq("skill_id", post.skill_id)
        .eq("is_published", true)
        .eq("is_paused", false)
        .order("sort_order")
        .limit(10);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Necesidad" backHref={isOwner ? "/needs" : "/oportunidades"} />
      <p className="text-ink/70 mt-2 text-[13px] font-bold">
        {post.skill_name ?? "Rubro"} · {STATUS_LABELS[post.status]}
      </p>
      <h1 className="mt-1 text-xl font-extrabold tracking-[-0.02em]">
        {post.title}
      </h1>
      <p className="text-ink/80 mt-3 text-[15px] leading-7 whitespace-pre-line">
        {post.description}
      </p>
      <dl className="text-ink/70 mt-4 flex flex-col gap-1.5 text-sm">
        {post.location_text ? (
          <div className="flex gap-2">
            <dt className="font-bold">Zona:</dt>
            <dd>{post.location_text}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="font-bold">Cuándo:</dt>
          <dd>{scheduleLabel(post.schedule_start_at, post.schedule_end_at)}</dd>
        </div>
        {post.desired_budget_amount ? (
          <div className="flex gap-2">
            <dt className="font-bold">Presupuesto estimado:</dt>
            <dd>
              {formatMinorUnits(post.desired_budget_amount, post.currency_code)}
            </dd>
          </div>
        ) : null}
      </dl>

      {isOwner ? (
        <section className="mt-6" aria-label="Gestión de la necesidad">
          <p className="text-sm font-bold">
            {offerCount === 0
              ? "Todavía no recibiste ofertas"
              : `${offerCount} ${offerCount === 1 ? "oferta recibida" : "ofertas recibidas"}`}
          </p>
          <p className="text-ink/70 mt-1 text-[13px] leading-5">
            Las ofertas llegan como mensajes: negociás la última versión y al
            aceptar se crea el trabajo. El pago se acuerda por fuera de YALO.
          </p>
          {(post.status === "OPEN" || post.status === "PAUSED") && (
            <div className="mt-3 flex gap-2">
              <form action={governNeedAction}>
                <input type="hidden" name="postId" value={post.id} />
                <input
                  type="hidden"
                  name="status"
                  value={post.status === "OPEN" ? "PAUSED" : "OPEN"}
                />
                <ActionButton
                  type="submit"
                  tone="secondary"
                  className="min-h-0 px-3 py-2 text-sm"
                >
                  {post.status === "OPEN" ? "Pausar" : "Reanudar"}
                </ActionButton>
              </form>
              <form action={governNeedAction}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="status" value="CLOSED" />
                <ActionButton
                  type="submit"
                  tone="ghost"
                  className="min-h-0 px-3 py-2 text-sm"
                >
                  Cerrar
                </ActionButton>
              </form>
            </div>
          )}
        </section>
      ) : post.status === "OPEN" ? (
        <section className="mt-6" aria-label="Ofertar en esta necesidad">
          {(myServices ?? []).length === 0 ? (
            <p className="text-ink/70 text-sm leading-6">
              Para ofertar necesitás un servicio publicado en este rubro.{" "}
              <ActionLink
                href="/provider/manage"
                tone="secondary"
                className="min-h-0 px-3 py-2 text-sm"
              >
                Gestionar mis servicios
              </ActionLink>
            </p>
          ) : (
            <form action={offerOnNeedAction} className="flex flex-col gap-4">
              <input type="hidden" name="postId" value={post.id} />
              <FormField
                label="¿Con qué servicio ofertás?"
                helper="Se abre un chat con el cliente y tu oferta viaja como propuesta."
              >
                <select
                  name="serviceId"
                  required
                  defaultValue=""
                  className={marketplaceInputClass}
                >
                  <option value="" disabled>
                    Elegí uno de tus servicios
                  </option>
                  {(myServices ?? []).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.title}
                    </option>
                  ))}
                </select>
              </FormField>
              <ActionButton type="submit">Ofertar en esta necesidad</ActionButton>
            </form>
          )}
        </section>
      ) : (
        <p className="text-ink/70 mt-6 text-sm">
          Esta necesidad ya no está abierta.
        </p>
      )}
    </main>
  );
}
