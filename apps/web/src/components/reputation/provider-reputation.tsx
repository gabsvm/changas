import {
  getPublicProviderReputation,
  listPublicProviderReputationContext,
  listPublicProviderReviews,
} from "@/lib/reputation/server";
import { createClient } from "@/lib/supabase/server";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { StatusChip } from "@/components/ui/marketplace/status-chip";

function percent(value: number | null): string {
  return value === null ? "Sin datos" : `${Math.round(value * 100)}%`;
}

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
      <div className="border-ink/[0.08] consumer-card bg-surface rounded-3xl border p-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-6 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
        <div id="reputation-title">
          <SectionHeader
            title="Reputación"
            badge={{ tone: "gold", icon: "star", label: "Reputación verificada" }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
              Reputación verificada
            </p>
            <p className="font-display mt-2 flex flex-wrap items-center gap-2 text-3xl font-semibold">
              {summary.review_count > 0 && summary.rating_average !== null ? (
                <>
                  <IllustratedBadge tone="gold" icon="star" size="sm" label={`Promedio ${summary.rating_average.toFixed(1)} de 5`} />
                  <span>{summary.rating_average.toFixed(1)} de 5</span>
                </>
              ) : (
                "Nuevo proveedor"
              )}
            </p>
            <p className="text-ink/70 mt-1 text-sm">
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
          <p className="mt-4">
            <StatusChip tone="success">
              {summary.repeat_client_count} clientes volvieron a contratarlo
            </StatusChip>
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
            <p className="text-ink/70 text-xs font-semibold tracking-wide uppercase">
              Historial por servicio y habilidad
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contexts.slice(0, 8).map((context) => (
                <StatusChip
                  tone="neutral"
                  key={`${context.context_type}-${context.context_slug}`}
                >
                  <strong>{context.context_name}</strong>
                  {context.rating_average !== null
                    ? ` · ${context.rating_average.toFixed(1)} / 5`
                    : ""}
                  {` · ${context.completed_jobs} completados`}
                </StatusChip>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-ink/[0.08] consumer-card bg-surface rounded-3xl border p-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-6 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
        <span className="flex min-w-0 items-center gap-2.5">
          <IllustratedBadge tone="blue" icon="chat" size="sm" label="Reseñas verificadas" />
          <h2 className="font-display text-2xl font-semibold">
            Reseñas verificadas
          </h2>
        </span>
        {reviews.length > 0 ? (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <article
                key={review.review_id}
                className="border-ink/[0.08] bg-surface consumer-card rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)",
                      }}
                      aria-hidden="true"
                    >
                      {review.reviewer_display_name.trim().charAt(0).toUpperCase() || "C"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {review.reviewer_display_name}
                      </p>
                      <StarRow value={review.rating} label={`${review.rating} de 5 estrellas`} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-ink/70 text-xs">
                      {review.service_title} · {review.skill_name}
                    </p>
                    <time
                      className="text-ink/70 mt-0.5 block text-xs font-semibold"
                      dateTime={review.created_at}
                    >
                      {new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "medium",
                      }).format(new Date(review.created_at))}
                    </time>
                  </div>
                </div>
                {review.review_text ? (
                  <p className="text-ink/70 mt-3 text-sm leading-6 whitespace-pre-wrap">
                    {review.review_text}
                  </p>
                ) : null}
                {review.provider_reply ? (
                  <div className="bg-canvas mt-3 rounded-xl p-3 text-sm">
                    <p className="text-ink/70 text-xs font-bold tracking-wide uppercase">
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
          <p className="text-ink/70 mt-3 text-sm">
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
    <div className="border-ink/[0.08] bg-surface consumer-card min-w-24 rounded-2xl border px-3 py-2 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-ink/70 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

function Dimension({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="border-ink/[0.08] bg-surface consumer-card rounded-2xl border px-3.5 py-3 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-ink/70 text-xs font-semibold">{label}</p>
        <p className="flex items-center gap-1.5 text-sm font-extrabold">
          <StarRow value={value} label={`${label}: ${value.toFixed(1)} de 5`} />
          {value.toFixed(1)} / 5
        </p>
      </div>
      <div
        className="bg-ink/[0.08] mt-2 h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${value.toFixed(1)} de 5`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundImage:
              "linear-gradient(135deg, #FF9A3D 0%, #EE5A24 100%)",
          }}
        />
      </div>
    </div>
  );
}
