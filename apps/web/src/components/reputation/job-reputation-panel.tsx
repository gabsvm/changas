import type { JobStatus } from "@changas/domain";

import {
  createJobReviewAction,
  rehireJobAction,
  replyToJobReviewAction,
  reportJobReviewAction,
} from "@/app/(account)/jobs/actions";
import { getJobReviewState } from "@/lib/reputation/server";
import { createClient } from "@/lib/supabase/server";

function stars(value: number): string {
  return "★".repeat(Math.max(1, Math.min(5, Math.round(value))));
}

function DimensionSelect({ name, label }: { name: string; label: string }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        name={name}
        defaultValue=""
        className="border-ink/10 mt-1 block h-11 w-full rounded-xl border bg-white px-3 font-normal"
      >
        <option value="">Sin calificar</option>
        {[1, 2, 3, 4, 5].map((value) => (
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
      className="border-ink/10 rounded-3xl border bg-white/75 p-5 sm:p-6"
      aria-labelledby="job-reputation-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-xs font-bold tracking-[0.14em] uppercase">
            Reputación verificada
          </p>
          <h2
            id="job-reputation-title"
            className="font-display mt-2 text-2xl font-semibold"
          >
            Reseña del trabajo
          </h2>
          <p className="text-ink/55 mt-1 max-w-xl text-sm leading-6">
            La reseña queda vinculada a este trabajo completado y no puede ser
            eliminada por el proveedor.
          </p>
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
              className="border-ink/10 mt-1 block h-11 w-full rounded-xl border bg-white px-3 font-normal sm:max-w-xs"
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
              className="border-ink/10 mt-1 block w-full rounded-2xl border bg-white px-4 py-3 font-normal"
              placeholder="Contá cómo fue el trabajo"
            />
          </label>
          <button className="button-primary w-fit" type="submit">
            Publicar reseña
          </button>
        </form>
      ) : null}

      {state.review_id && state.rating ? (
        <article className="bg-canvas mt-5 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p
                className="text-terracotta font-semibold"
                aria-label={`${state.rating} de 5 estrellas`}
              >
                {stars(state.rating)}
              </p>
              <p className="text-ink/50 mt-1 text-xs">
                Reseña verificada de este Job
              </p>
            </div>
            {state.review_created_at ? (
              <time className="text-ink/45 text-xs">
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
            <div className="border-ink/10 mt-4 rounded-xl border bg-white/70 p-3 text-sm">
              <p className="text-ink/45 text-xs font-bold tracking-wide uppercase">
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
                    className="border-ink/10 mt-1 block w-full rounded-xl border bg-white px-3 py-2 font-normal"
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
                      className="border-ink/10 mt-1 block h-11 w-full rounded-xl border bg-white px-3 font-normal"
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
                    className="border-ink/10 rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="Detalle opcional"
                  />
                  <button className="button-secondary w-fit" type="submit">
                    Enviar reporte
                  </button>
                </form>
              ) : (
                <p className="text-ink/55 self-center text-sm">
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
