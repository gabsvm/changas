import type { JobStatus } from "@changas/domain";

import {
  createJobReviewAction,
  rehireJobAction,
  replyToJobReviewAction,
  reportJobReviewAction,
} from "@/app/(account)/jobs/actions";
import { getJobReviewState } from "@/lib/reputation/server";
import { createClient } from "@/lib/supabase/server";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { StatusChip } from "@/components/ui/marketplace/status-chip";

function StarRow({ value, label }: { value: number; label?: string }) {
  const filled = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label ?? `${value} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <svg
          key={index}
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${index <= filled ? "fill-brand-yellow stroke-brand-yellow" : "fill-ink/[0.08] stroke-ink/20"}`}
          strokeWidth="1.5"
        >
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8Z"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function DimensionSelect({ name, label }: { name: string; label: string }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        name={name}
        defaultValue="5"
        className="border-ink/10 bg-surface mt-1 block h-11 w-full rounded-xl border px-3 font-normal shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
      >
        {[5, 4, 3, 2, 1].map((value) => (
          <option key={value} value={value}>
            {value} / 5
          </option>
        ))}
      </select>
    </label>
  );
}

export async function JobReputationPanel({
  jobId,
  status,
  isClient,
  isProvider,
}: {
  jobId: string;
  status: JobStatus;
  isClient: boolean;
  isProvider: boolean;
}) {
  if (status !== "COMPLETED") return null;

  const supabase = await createClient();
  const state = await getJobReviewState(supabase, jobId);
  if (!state) return null;

  return (
    <section
      className="border-ink/[0.08] consumer-card bg-surface rounded-3xl border p-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-6 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
      aria-labelledby="job-reputation-title"
    >
      <div id="job-reputation-title">
        <SectionHeader
          title="Reseña del trabajo"
          badge={{ tone: "gold", icon: "star", label: "Reseña del trabajo" }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-xs font-bold tracking-[0.14em] uppercase">
            Reputación verificada
          </p>
          <p className="text-ink/70 mt-1 max-w-xl text-sm leading-6">
            La reseña queda vinculada a este trabajo completado y no puede ser
            eliminada por el proveedor.
          </p>
          {state.review_id && state.rating ? (
            <p className="mt-2">
              <StatusChip tone="success">Reseña verificada de este trabajo</StatusChip>
            </p>
          ) : null}
        </div>
        {isClient ? (
          <form action={rehireJobAction}>
            <input type="hidden" name="jobId" value={jobId} />
            <button className="button-primary" type="submit">
              Volver a contratar
            </button>
          </form>
        ) : null}
      </div>

      {isClient && state.can_review ? (
        <form action={createJobReviewAction} className="mt-5 grid gap-4">
          <input type="hidden" name="jobId" value={jobId} />
          <label className="text-sm font-semibold">
            Calificación general
            <select
              name="rating"
              required
              defaultValue="5"
              className="border-ink/10 bg-surface mt-1 block h-11 w-full rounded-xl border px-3 font-normal shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none sm:max-w-xs dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <DimensionSelect name="qualityRating" label="Calidad" />
            <DimensionSelect name="punctualityRating" label="Puntualidad" />
            <DimensionSelect name="communicationRating" label="Comunicación" />
          </div>
          <label className="text-sm font-semibold">
            Comentario
            <textarea
              name="reviewText"
              rows={4}
              maxLength={2000}
              className="border-ink/10 bg-surface mt-1 block w-full rounded-2xl border px-4 py-3 font-normal shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
              placeholder="Contá cómo fue el trabajo"
            />
          </label>
          <button className="button-primary w-fit" type="submit">
            Publicar reseña
          </button>
        </form>
      ) : null}

      {state.review_id && state.rating ? (
        <article className="border-ink/[0.08] bg-surface consumer-card mt-5 rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2">
                <IllustratedBadge tone="gold" icon="star" size="sm" label={`${state.rating} de 5 estrellas`} />
                <StarRow value={state.rating} label={`${state.rating} de 5 estrellas`} />
              </p>
              <p className="text-ink/70 mt-1 text-xs">
                Reseña verificada de este trabajo
              </p>
            </div>
            {state.review_created_at ? (
              <time className="text-ink/70 text-xs">
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "medium",
                }).format(new Date(state.review_created_at))}
              </time>
            ) : null}
          </div>
          {state.review_text ? (
            <p className="mt-3 text-sm leading-6 whitespace-pre-wrap">
              {state.review_text}
            </p>
          ) : null}

          {state.provider_reply ? (
            <div className="border-ink/10 bg-canvas mt-4 rounded-xl border p-3 text-sm">
              <p className="text-ink/70 text-xs font-bold tracking-wide uppercase">
                Respuesta del proveedor
              </p>
              <p className="mt-1 leading-6 whitespace-pre-wrap">
                {state.provider_reply}
              </p>
            </div>
          ) : null}

          {isProvider ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <form action={replyToJobReviewAction} className="grid gap-2">
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="reviewId" value={state.review_id} />
                <label className="text-sm font-semibold">
                  Respuesta pública
                  <textarea
                    name="replyText"
                    minLength={2}
                    maxLength={1500}
                    required
                    defaultValue={state.provider_reply ?? ""}
                    rows={3}
                    className="border-ink/10 bg-surface mt-1 block w-full rounded-xl border px-3 py-2 font-normal shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
                  />
                </label>
                <button className="button-secondary w-fit" type="submit">
                  {state.provider_reply
                    ? "Actualizar respuesta"
                    : "Responder reseña"}
                </button>
              </form>

              {!state.reported_by_caller ? (
                <form action={reportJobReviewAction} className="grid gap-2">
                  <input type="hidden" name="jobId" value={jobId} />
                  <input
                    type="hidden"
                    name="reviewId"
                    value={state.review_id}
                  />
                  <label className="text-sm font-semibold">
                    Reportar reseña
                    <select
                      name="reason"
                      defaultValue="OTHER"
                      className="border-ink/10 bg-surface mt-1 block h-11 w-full rounded-xl border px-3 font-normal shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
                    >
                      <option value="IRRELEVANT_CONTENT">
                        Contenido irrelevante
                      </option>
                      <option value="INSULTS">Insultos</option>
                      <option value="THREATS">Amenazas</option>
                      <option value="PRIVATE_INFORMATION">
                        Información privada
                      </option>
                      <option value="DISCRIMINATION">Discriminación</option>
                      <option value="EXTORTION">Extorsión</option>
                      <option value="ABUSE">Abuso</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </label>
                  <textarea
                    name="details"
                    rows={2}
                    maxLength={1000}
                    className="border-ink/10 bg-surface rounded-xl border px-3 py-2 text-sm shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] outline-none dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
                    placeholder="Detalle opcional"
                  />
                  <button className="button-secondary w-fit" type="submit">
                    Enviar reporte
                  </button>
                </form>
              ) : (
                <p className="text-ink/70 self-center text-sm">
                  Ya reportaste esta reseña para revisión.
                </p>
              )}
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
