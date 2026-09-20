import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMinorUnits, type JobStatus } from "@changas/domain";

import {
  fakeAdditionalPaymentAction,
  requestRescheduleAction,
  requestScopeChangeAction,
  respondRescheduleAction,
  respondScopeChangeAction,
  setJobLocationAction,
  transitionJobAction,
} from "@/app/(account)/jobs/actions";
import { JobReputationPanel } from "@/components/reputation/job-reputation-panel";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import {
  getJobDetail,
  JobServerError,
  listJobEvents,
  listJobRescheduleRequests,
  listJobScopeChanges,
} from "@/lib/jobs/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatusPresentation } from "@/lib/ui/job-status";
import { getServiceModalityLabel } from "@/lib/ui/service-modality";

function dateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scheduleTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    FIXED_SLOT: "Horario fijo",
    FLEXIBLE_WINDOW: "Ventana flexible",
    DEADLINE: "Fecha límite",
    UNSCHEDULED: "A coordinar",
  };
  return labels[value] ?? "Agenda a coordinar";
}

function requestStatus(value: string) {
  const labels: Record<
    string,
    {
      label: string;
      tone: "neutral" | "info" | "success" | "warning" | "danger";
    }
  > = {
    OPEN: { label: "Pendiente", tone: "warning" },
    ACCEPTED: { label: "Aceptada", tone: "success" },
    REJECTED: { label: "Rechazada", tone: "danger" },
    WITHDRAWN: { label: "Retirada", tone: "neutral" },
  };
  return (
    labels[value] ?? { label: "Estado de solicitud", tone: "neutral" as const }
  );
}

function scopeStatus(value: string) {
  const labels: Record<
    string,
    {
      label: string;
      tone: "neutral" | "info" | "success" | "warning" | "danger";
    }
  > = {
    OPEN: { label: "Pendiente", tone: "warning" },
    REJECTED: { label: "Rechazado", tone: "danger" },
    WITHDRAWN: { label: "Retirado", tone: "neutral" },
    AWAITING_PAYMENT: { label: "Esperando pago", tone: "warning" },
    PAYMENT_FAILED: { label: "Pago fallido", tone: "danger" },
    PAID: { label: "Pagado", tone: "success" },
  };
  return (
    labels[value] ?? { label: "Estado del cambio", tone: "neutral" as const }
  );
}

function eventLabel(value: string): string {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  let detail;
  try {
    detail = await getJobDetail(jobId);
  } catch (error) {
    if (
      error instanceof JobServerError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      notFound();
    }
    throw error;
  }

  const [events, reschedules, scopeChanges] = await Promise.all([
    listJobEvents(jobId),
    listJobRescheduleRequests(jobId),
    listJobScopeChanges(jobId),
  ]);

  const isClient = user.id === detail.client_user_id;
  const isProvider = user.id === detail.provider_user_id;
  const schedulePrimary =
    detail.schedule_starts_at ?? detail.schedule_deadline_at ?? null;
  const status = getJobStatusPresentation(detail.job_status);
  const nextTransition: {
    expected: JobStatus;
    requested: JobStatus;
    heading: string;
    label: string;
  } | null =
    isProvider && detail.job_status === "CONFIRMED"
      ? {
          expected: "CONFIRMED",
          requested: "IN_PROGRESS",
          heading: "Iniciá el trabajo cuando llegues",
          label: "Iniciar trabajo",
        }
      : isProvider && detail.job_status === "IN_PROGRESS"
        ? {
            expected: "IN_PROGRESS",
            requested: "COMPLETION_REQUESTED",
            heading: "Pedí la finalización al terminar",
            label: "Solicitar finalización",
          }
        : isClient && detail.job_status === "COMPLETION_REQUESTED"
          ? {
              expected: "COMPLETION_REQUESTED",
              requested: "COMPLETED",
              heading: "Confirmá que el trabajo está listo",
              label: "Confirmar finalización",
            }
          : null;
  const price = formatMinorUnits(
    detail.base_price_amount,
    detail.currency_code as "ARS",
  );

  return (
    <section className="pb-8 sm:py-14">
      <MobileAppBar
        title="Trabajo"
        backHref="/jobs"
        trailing={
          <Link
            href={`/messages/${detail.conversation_id}`}
            className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.08] inline-flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold"
            aria-label="Abrir conversación"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
            >
              <path
                d="M4 5.5h16v11H9l-5 4v-15Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Chat
          </Link>
        }
      />

      <div className="mx-auto max-w-4xl pt-5 sm:pt-0">
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <Link href="/jobs" className="text-ink/55 text-sm font-semibold">
            ← Mis trabajos
          </Link>
          <Link
            href={`/messages/${detail.conversation_id}`}
            className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
          >
            Abrir conversación
          </Link>
        </div>

        <header className="consumer-card bg-surface mt-0 p-4 sm:mt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <StatusChip tone="neutral">
              {getServiceModalityLabel(detail.modality)}
            </StatusChip>
          </div>
          <h1 className="mt-3 text-[22px] leading-8 font-extrabold tracking-[-0.025em]">
            {detail.service_title}
          </h1>
          <p className="text-ink/60 mt-1.5 text-sm leading-6">
            Con {detail.counterparty_name} · {price}
          </p>
          <div className="bg-canvas mt-4 grid grid-cols-2 gap-3 rounded-xl p-4 text-sm">
            <div>
              <p className="text-ink/60 text-xs leading-4 font-semibold">
                Próxima fecha
              </p>
              <p className="mt-0.5 font-bold">
                {schedulePrimary
                  ? (dateTime(schedulePrimary) ?? "A coordinar")
                  : "A coordinar"}
              </p>
            </div>
            <div>
              <p className="text-ink/60 text-xs leading-4 font-semibold">
                Precio acordado
              </p>
              <p className="mt-0.5 font-extrabold">{price}</p>
            </div>
          </div>
        </header>

        {nextTransition ? (
          <section
            className="bg-ink mt-5 rounded-2xl p-5 text-white"
            aria-label="Próxima acción"
          >
            <p className="text-[0.68rem] font-bold tracking-[0.08em] text-white/60 uppercase">
              Próxima acción
            </p>
            <h2 className="mt-1 text-lg leading-7 font-extrabold">
              {nextTransition.heading}
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <StatusButton
                jobId={jobId}
                expected={nextTransition.expected}
                requested={nextTransition.requested}
                label={nextTransition.label}
              />
              <Link
                href={`/messages/${detail.conversation_id}`}
                className="consumer-pressable inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-bold text-white"
              >
                Ver chat
              </Link>
            </div>
          </section>
        ) : null}

        <section className="border-ink/10 mt-6 border-t pt-5">
          <p className="text-ink/42 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
            Alcance acordado
          </p>
          <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">
            {detail.scope_snapshot}
          </p>
        </section>

        <div className="mt-5">
          <JobReputationPanel
            jobId={jobId}
            status={detail.job_status}
            isClient={isClient}
            isProvider={isProvider}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-8">
            <JobSection title="Acciones del trabajo">
              {["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
                detail.job_status,
              ) ? (
                <details className="border-ink/10 mt-3 border-t pt-3">
                  <summary className="consumer-pressable min-h-11 cursor-pointer py-3 text-sm font-semibold">
                    Cancelar o informar un problema
                  </summary>
                  <div className="grid gap-3 pb-2 sm:grid-cols-2">
                    <ReasonTransitionForm
                      jobId={jobId}
                      expected={detail.job_status}
                      requested="CANCELLED"
                      label="Cancelar trabajo"
                    />
                    <ReasonTransitionForm
                      jobId={jobId}
                      expected={detail.job_status}
                      requested="DISPUTED"
                      label="Reportar problema"
                    />
                    {detail.job_status === "CONFIRMED" ? (
                      <ReasonTransitionForm
                        jobId={jobId}
                        expected="CONFIRMED"
                        requested="NO_SHOW"
                        label="Registrar ausencia"
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}
            </JobSection>

            {detail.job_status === "CONFIRMED" ? (
              <JobSection
                title="Reprogramar"
                collapsible
                description="La otra parte debe aceptar el nuevo horario antes de reemplazar al actual."
              >
                <form
                  action={requestRescheduleAction}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="jobId" value={jobId} />
                  <label className="text-sm font-semibold">
                    Tipo de agenda
                    <select
                      name="scheduleType"
                      defaultValue="FIXED_SLOT"
                      className="border-ink/10 mt-1 block h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    >
                      <option value="FIXED_SLOT">Horario fijo</option>
                      <option value="FLEXIBLE_WINDOW">Ventana flexible</option>
                      <option value="DEADLINE">Fecha límite</option>
                      <option value="UNSCHEDULED">A coordinar</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Motivo
                    <input
                      name="reason"
                      className="border-ink/10 mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                      placeholder="Cambio de disponibilidad"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Inicio
                    <input
                      type="datetime-local"
                      name="startsAt"
                      className="border-ink/10 mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Fin
                    <input
                      type="datetime-local"
                      name="endsAt"
                      className="border-ink/10 mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Fecha límite
                    <input
                      type="datetime-local"
                      name="deadlineAt"
                      className="border-ink/10 mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    />
                  </label>
                  <button className="button-secondary self-end">
                    Solicitar reprogramación
                  </button>
                </form>

                {reschedules.length > 0 ? (
                  <div className="border-ink/10 divide-ink/10 mt-4 divide-y border-t">
                    {reschedules.map((request) => {
                      const state = requestStatus(request.request_status);
                      return (
                        <article
                          key={request.request_id}
                          className="py-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <strong>
                              {scheduleTypeLabel(request.schedule_type)}
                            </strong>
                            <StatusChip tone={state.tone}>
                              {state.label}
                            </StatusChip>
                          </div>
                          <p className="text-ink/55 mt-1">
                            {dateTime(
                              request.starts_at ?? request.deadline_at,
                            ) ?? "A coordinar"}
                          </p>
                          {request.request_status === "OPEN" &&
                          request.requested_by_user_id !== user.id ? (
                            <form
                              action={respondRescheduleAction}
                              className="mt-3 flex flex-wrap gap-2"
                            >
                              <input type="hidden" name="jobId" value={jobId} />
                              <input
                                type="hidden"
                                name="requestId"
                                value={request.request_id}
                              />
                              <button
                                name="action"
                                value="ACCEPT"
                                className="button-primary text-xs"
                              >
                                Aceptar
                              </button>
                              <button
                                name="action"
                                value="REJECT"
                                className="button-secondary text-xs"
                              >
                                Rechazar
                              </button>
                            </form>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </JobSection>
            ) : null}

            {(detail.job_status === "CONFIRMED" ||
              detail.job_status === "IN_PROGRESS") &&
            isProvider ? (
              <JobSection
                title="Cambio de alcance"
                collapsible
                description="Un aumento de precio requiere aceptación del cliente y pago adicional confirmado."
              >
                <form action={requestScopeChangeAction} className="grid gap-3">
                  <input type="hidden" name="jobId" value={jobId} />
                  <textarea
                    name="scope"
                    required
                    minLength={3}
                    rows={4}
                    className="border-ink/10 rounded-xl border bg-white px-3 py-3 text-sm"
                    placeholder="Describí exactamente qué cambia"
                  />
                  <label className="text-sm font-semibold">
                    Adicional en ARS (0 si no cambia el precio)
                    <input
                      name="additionalPrice"
                      inputMode="decimal"
                      defaultValue="0"
                      className="border-ink/10 mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    />
                  </label>
                  <button className="button-secondary">Proponer cambio</button>
                </form>
              </JobSection>
            ) : null}

            {scopeChanges.length > 0 ? (
              <JobSection title="Cambios de alcance">
                <div className="divide-ink/10 divide-y">
                  {scopeChanges.map((change) => {
                    const state = scopeStatus(change.change_status);
                    return (
                      <article key={change.scope_change_id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <StatusChip tone={state.tone}>
                            {state.label}
                          </StatusChip>
                          <span className="text-ink/45 text-xs">
                            {dateTime(change.created_at)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">
                          {change.scope_snapshot}
                        </p>
                        <div className="text-ink/55 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>Actual: {price}</span>
                          <span>
                            Adicional:{" "}
                            {formatMinorUnits(
                              change.additional_amount_minor,
                              change.currency_code as "ARS",
                            )}
                          </span>
                          <strong className="text-ink">
                            Nuevo total:{" "}
                            {formatMinorUnits(
                              detail.base_price_amount +
                                change.additional_amount_minor,
                              detail.currency_code as "ARS",
                            )}
                          </strong>
                        </div>
                        {isClient && change.change_status === "OPEN" ? (
                          <form
                            action={respondScopeChangeAction}
                            className="mt-3 flex flex-wrap gap-2"
                          >
                            <input type="hidden" name="jobId" value={jobId} />
                            <input
                              type="hidden"
                              name="scopeChangeId"
                              value={change.scope_change_id}
                            />
                            <button
                              name="action"
                              value="ACCEPT"
                              className="button-primary text-xs"
                            >
                              Aceptar cambio
                            </button>
                            <button
                              name="action"
                              value="REJECT"
                              className="button-secondary text-xs"
                            >
                              Rechazar
                            </button>
                          </form>
                        ) : null}
                        {isClient &&
                        process.env.NODE_ENV !== "production" &&
                        ["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(
                          change.change_status,
                        ) ? (
                          <form
                            action={fakeAdditionalPaymentAction}
                            className="mt-3 flex flex-wrap gap-2"
                          >
                            <input type="hidden" name="jobId" value={jobId} />
                            <input
                              type="hidden"
                              name="scopeChangeId"
                              value={change.scope_change_id}
                            />
                            <input
                              type="hidden"
                              name="paymentNonce"
                              value={crypto.randomUUID()}
                            />
                            <button
                              name="outcome"
                              value="SUCCESS"
                              className="button-primary text-xs"
                            >
                              Simular pago aprobado
                            </button>
                            <button
                              name="outcome"
                              value="FAILURE"
                              className="button-secondary text-xs"
                            >
                              Simular fallo
                            </button>
                          </form>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </JobSection>
            ) : null}
          </div>

          <aside className="space-y-8">
            {detail.modality === "IN_PERSON" || detail.modality === "BOTH" ? (
              <JobSection title="Ubicación del trabajo">
                {detail.exact_address ? (
                  <div className="text-sm leading-6">
                    <strong className="block">{detail.exact_address}</strong>
                    {detail.access_notes ? (
                      <span className="text-ink/55">{detail.access_notes}</span>
                    ) : null}
                  </div>
                ) : isClient &&
                  ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
                    detail.job_status,
                  ) ? (
                  <form action={setJobLocationAction} className="space-y-3">
                    <input type="hidden" name="jobId" value={jobId} />
                    <input
                      name="address"
                      required
                      minLength={5}
                      placeholder="Dirección exacta"
                      className="border-ink/10 h-11 w-full rounded-xl border bg-white px-3 text-sm"
                    />
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Piso, timbre o indicaciones"
                      className="border-ink/10 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                    <button className="button-secondary w-full">
                      Guardar ubicación
                    </button>
                  </form>
                ) : (
                  <p className="text-ink/55 text-sm leading-6">
                    La dirección exacta se comparte sólo dentro del trabajo
                    confirmado y únicamente con sus participantes.
                  </p>
                )}
              </JobSection>
            ) : null}

            <JobSection title="Historial">
              <ol className="border-ink/10 relative space-y-4 border-l-2 pl-4">
                {events.map((event) => (
                  <li key={event.event_id} className="relative text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="bg-moss ring-canvas absolute top-1 -left-[22px] h-2.5 w-2.5 rounded-full ring-4" />
                      <div className="min-w-0">
                        <strong className="block">
                          {eventLabel(event.event_type)}
                        </strong>
                        <time className="text-ink/42 mt-1 block text-xs leading-4">
                          {dateTime(event.created_at)}
                        </time>
                        {event.reason ? (
                          <p className="text-ink/58 mt-1.5 leading-6">
                            {event.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </JobSection>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink/42 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function JobSection({
  title,
  description,
  children,
  collapsible = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="border-ink/10 border-t pt-4">
        <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-lg leading-7 font-bold tracking-[-0.015em]">
          {title}
          <span className="text-ink/40 text-xl" aria-hidden="true">
            ›
          </span>
        </summary>
        {description ? (
          <p className="text-ink/52 mt-1.5 text-sm leading-6">{description}</p>
        ) : null}
        <div className="mt-3 pb-1">{children}</div>
      </details>
    );
  }
  return (
    <section className="border-ink/10 border-t pt-4">
      <h2 className="text-lg leading-7 font-bold tracking-[-0.015em]">
        {title}
      </h2>
      {description ? (
        <p className="text-ink/52 mt-1.5 text-sm leading-6">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatusButton({
  jobId,
  expected,
  requested,
  label,
}: {
  jobId: string;
  expected: JobStatus;
  requested: JobStatus;
  label: string;
}) {
  return (
    <form action={transitionJobAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="expectedStatus" value={expected} />
      <input type="hidden" name="requestedStatus" value={requested} />
      <button className="button-primary w-full">{label}</button>
    </form>
  );
}

function ReasonTransitionForm({
  jobId,
  expected,
  requested,
  label,
}: {
  jobId: string;
  expected: JobStatus;
  requested: "CANCELLED" | "DISPUTED" | "NO_SHOW";
  label: string;
}) {
  return (
    <form action={transitionJobAction} className="border-ink/10 border-t pt-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="expectedStatus" value={expected} />
      <input type="hidden" name="requestedStatus" value={requested} />
      <label className="text-xs font-semibold">
        Motivo
        <textarea
          name="reason"
          required
          minLength={2}
          rows={2}
          className="border-ink/10 mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal"
        />
      </label>
      <button className="button-secondary mt-2 w-full text-xs">{label}</button>
    </form>
  );
}
