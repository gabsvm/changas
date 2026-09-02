import {
  getPublicProviderReputation,
  listPublicProviderReputationContext,
  listPublicProviderReviews,
} from "@/lib/reputation/server";
import { createClient } from "@/lib/supabase/server";

function percent(value: number | null): string {
  return value === null ? "Sin datos" : `${Math.round(value * 100)}%`;
}

function stars(value: number): string {
  return "★".repeat(Math.max(1, Math.min(5, Math.round(value))));
}

export async function ProviderReputation({
  providerSlug,
}: {
  providerSlug: string;
}) {
  const supabase = await createClient();
  const [summary, contexts, reviews] = await Promise.all([
    getPublicProviderReputation(supabase, providerSlug),
    listPublicProviderReputationContext(supabase, providerSlug),
    listPublicProviderReviews(supabase, providerSlug),
  ]);

  if (!summary) return null;

  return (
    <section className="mt-6 space-y-6" aria-labelledby="reputation-title">
      <div className="border-ink/10 rounded-3xl border bg-white/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
              Reputación verificada
            </p>
            <h2
              id="reputation-title"
              className="font-display mt-2 text-3xl font-semibold"
            >
              {summary.review_count > 0 && summary.rating_average !== null
                ? `★ ${summary.rating_average.toFixed(1)} de 5`
                : "Nuevo proveedor"}
            </h2>
            <p className="text-ink/55 mt-1 text-sm">
              {summary.review_count > 0
                ? `${summary.review_count} ${summary.review_count === 1 ? "reseña" : "reseñas"} de trabajos completados`
                : "Todavía no tiene reseñas verificadas en Changas."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <Metric
              label="Completados"
              value={String(summary.completed_jobs)}
            />
            <Metric
              label="Finalización"
              value={percent(summary.completion_rate)}
            />
            <Metric
              label="Cancelación"
              value={percent(summary.cancellation_rate)}
            />
            <Metric label="Ausencias" value={percent(summary.no_show_rate)} />
          </div>
        </div>

        {summary.repeat_client_count > 0 ? (
          <p className="bg-moss/10 text-moss mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold">
            {summary.repeat_client_count} clientes volvieron a contratarlo
          </p>
        ) : null}

        {summary.quality_rating_average !== null ||
        summary.punctuality_rating_average !== null ||
        summary.communication_rating_average !== null ? (
          <div className="border-ink/10 mt-5 grid gap-3 border-t pt-5 sm:grid-cols-3">
            <Dimension label="Calidad" value={summary.quality_rating_average} />
            <Dimension
              label="Puntualidad"
              value={summary.punctuality_rating_average}
            />
            <Dimension
              label="Comunicación"
              value={summary.communication_rating_average}
            />
          </div>
        ) : null}

        {contexts.length > 0 ? (
          <div className="border-ink/10 mt-5 border-t pt-5">
            <p className="text-ink/55 text-xs font-semibold tracking-wide uppercase">
              Historial por servicio y habilidad
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contexts.slice(0, 8).map((context) => (
                <span
                  key={`${context.context_type}-${context.context_slug}`}
                  className="border-ink/10 rounded-full border bg-white px-3 py-1.5 text-xs"
                >
                  <strong>{context.context_name}</strong>
                  {context.rating_average !== null
                    ? ` · ★ ${context.rating_average.toFixed(1)}`
                    : ""}
                  {` · ${context.completed_jobs} completados`}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-ink/10 rounded-3xl border bg-white/55 p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">
          Reseñas verificadas
        </h2>
        {reviews.length > 0 ? (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <article
                key={review.review_id}
                className="border-ink/10 rounded-2xl border bg-white/75 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {review.reviewer_display_name}
                    </p>
                    <p
                      className="text-terracotta text-sm"
                      aria-label={`${review.rating} de 5 estrellas`}
                    >
                      {stars(review.rating)}
                    </p>
                  </div>
                  <p className="text-ink/45 text-xs">
                    {review.service_title} · {review.skill_name}
                  </p>
                </div>
                {review.review_text ? (
                  <p className="text-ink/70 mt-3 text-sm leading-6 whitespace-pre-wrap">
                    {review.review_text}
                  </p>
                ) : null}
                {review.provider_reply ? (
                  <div className="bg-canvas mt-3 rounded-xl p-3 text-sm">
                    <p className="text-ink/45 text-xs font-bold tracking-wide uppercase">
                      Respuesta del proveedor
                    </p>
                    <p className="mt-1 leading-6 whitespace-pre-wrap">
                      {review.provider_reply}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-ink/55 mt-3 text-sm">
            Las primeras reseñas aparecerán después de trabajos completados y
            confirmados por clientes.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas min-w-24 rounded-xl px-3 py-2">
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-ink/50 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

function Dimension({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div>
      <p className="text-ink/50 text-xs font-semibold">{label}</p>
      <p className="mt-1 font-semibold">★ {value.toFixed(1)} / 5</p>
    </div>
  );
}
