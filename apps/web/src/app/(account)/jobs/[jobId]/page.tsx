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
import {
  getJobDetail,
  JobServerError,
  listJobEvents,
  listJobRescheduleRequests,
  listJobScopeChanges,
} from "@/lib/jobs/server";
import { createClient } from "@/lib/supabase/server";

function dateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusCopy(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En curso",
    COMPLETION_REQUESTED: "Finalización pendiente",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    DISPUTED: "Con problema reportado",
    REFUNDED: "Reintegrado",
    PARTIALLY_REFUNDED: "Reintegro parcial",
    EXPIRED: "Vencido",
    NO_SHOW: "Ausencia registrada",
  };
  return labels[status];
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-9">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/jobs" className="text-ink/60 text-sm font-semibold">
          ← Mis trabajos
        </Link>
        <Link
          href={`/messages/${detail.conversation_id}`}
          className="border-ink/10 rounded-full border bg-white/70 px-4 py-2 text-xs font-bold"
        >
          Abrir conversación
        </Link>
      </div>

      <section className="border-ink/10 rounded-[2rem] border bg-white/80 p-5 shadow-[0_20px_70px_rgba(22,56,50,0.06)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-moss text-xs font-bold tracking-[0.15em] uppercase">
              Trabajo protegido
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold">
              {detail.service_title}
            </h1>
            <p className="text-ink/55 mt-2 text-sm">
              Con {detail.counterparty_name}
            </p>
          </div>
          <span className="bg-moss/10 text-moss rounded-full px-4 py-2 text-xs font-bold">
            {statusCopy(detail.job_status)}
          </span>
        </div>

        <div className="border-ink/10 mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3">
          <div>
            <p className="text-ink/45 text-[11px] font-bold tracking-wide uppercase">
              Precio acordado
            </p>
            <p className="mt-1 font-semibold">
              {formatMinorUnits(
                detail.base_price_amount,
                detail.currency_code as "ARS",
              )}
            </p>
          </div>
          <div>
            <p className="text-ink/45 text-[11px] font-bold tracking-wide uppercase">
              Agenda
            </p>
            <p className="mt-1 font-semibold">
              {schedulePrimary ? dateTime(schedulePrimary) : "A coordinar"}
            </p>
          </div>
          <div>
            <p className="text-ink/45 text-[11px] font-bold tracking-wide uppercase">
              Modalidad
            </p>
            <p className="mt-1 font-semibold">
              {detail.modality.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <div className="bg-canvas mt-5 rounded-2xl p-4">
          <p className="text-ink/45 text-[11px] font-bold tracking-wide uppercase">
            Alcance congelado
          </p>
          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
            {detail.scope_snapshot}
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <section className="border-ink/10 rounded-3xl border bg-white/75 p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold">
              Acciones del trabajo
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {isProvider && detail.job_status === "CONFIRMED" ? (
                <StatusButton
                  jobId={jobId}
                  expected="CONFIRMED"
                  requested="IN_PROGRESS"
                  label="Iniciar trabajo"
                />
              ) : null}
              {isProvider && detail.job_status === "IN_PROGRESS" ? (
                <StatusButton
                  jobId={jobId}
                  expected="IN_PROGRESS"
                  requested="COMPLETION_REQUESTED"
                  label="Solicitar finalización"
                />
              ) : null}
              {isClient && detail.job_status === "COMPLETION_REQUESTED" ? (
                <StatusButton
                  jobId={jobId}
                  expected="COMPLETION_REQUESTED"
                  requested="COMPLETED"
                  label="Confirmar finalización"
                />
              ) : null}
            </div>

            {["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
              detail.job_status,
            ) ? (
              <details className="border-ink/10 mt-4 rounded-2xl border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Cancelar o informar un problema
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </section>

          {detail.job_status === "CONFIRMED" ? (
            <section className="border-ink/10 rounded-3xl border bg-white/75 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">
                Reprogramar
              </h2>
              <p className="text-ink/55 mt-1 text-sm">
                La otra parte debe aceptar el nuevo horario antes de que
                reemplace al actual.
              </p>
              <form
                action={requestRescheduleAction}
                className="mt-4 grid gap-3 sm:grid-cols-2"
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
                <div className="mt-5 space-y-3">
                  {reschedules.map((request) => (
                    <article
                      key={request.request_id}
                      className="bg-canvas rounded-2xl p-4 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong>
                          {request.schedule_type.replaceAll("_", " ")}
                        </strong>
                        <span className="text-ink/50 text-xs">
                          {request.request_status}
                        </span>
                      </div>
                      <p className="text-ink/60 mt-1">
                        {dateTime(request.starts_at ?? request.deadline_at) ??
                          "A coordinar"}
                      </p>
                      {request.request_status === "OPEN" &&
                      request.requested_by_user_id !== user.id ? (
                        <form
                          action={respondRescheduleAction}
                          className="mt-3 flex gap-2"
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
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {(detail.job_status === "CONFIRMED" ||
            detail.job_status === "IN_PROGRESS") &&
          isProvider ? (
            <section className="border-ink/10 rounded-3xl border bg-white/75 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">
                Cambio de alcance
              </h2>
              <p className="text-ink/55 mt-1 text-sm">
                Cualquier aumento de precio necesita aceptación del cliente y un
                pago adicional confirmado.
              </p>
              <form
                action={requestScopeChangeAction}
                className="mt-4 grid gap-3"
              >
                <input type="hidden" name="jobId" value={jobId} />
                <textarea
                  name="scope"
                  required
                  minLength={3}
                  rows={4}
                  className="border-ink/10 rounded-2xl border bg-white px-4 py-3 text-sm"
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
            </section>
          ) : null}

          {scopeChanges.length > 0 ? (
            <section className="border-ink/10 rounded-3xl border bg-white/75 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">
                Cambios de alcance
              </h2>
              <div className="mt-4 space-y-3">
                {scopeChanges.map((change) => (
                  <article
                    key={change.scope_change_id}
                    className="bg-canvas rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <strong>
                        {change.change_status.replaceAll("_", " ")}
                      </strong>
                      <span className="text-ink/50 text-xs">
                        {dateTime(change.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                      {change.scope_snapshot}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-ink/60">
                        Total actual:{" "}
                        {formatMinorUnits(
                          detail.base_price_amount,
                          detail.currency_code as "ARS",
                        )}
                      </span>
                      <span className="text-moss font-semibold">
                        Adicional:{" "}
                        {formatMinorUnits(
                          change.additional_amount_minor,
                          change.currency_code as "ARS",
                        )}
                      </span>
                      <span className="text-ink font-bold">
                        Nuevo total:{" "}
                        {formatMinorUnits(
                          detail.base_price_amount +
                            change.additional_amount_minor,
                          detail.currency_code as "ARS",
                        )}
                      </span>
                    </div>
                    {isClient && change.change_status === "OPEN" ? (
                      <form
                        action={respondScopeChangeAction}
                        className="mt-3 flex gap-2"
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
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          {detail.modality === "IN_PERSON" || detail.modality === "BOTH" ? (
            <section className="border-ink/10 rounded-3xl border bg-white/75 p-5">
              <h2 className="font-display text-xl font-semibold">
                Ubicación del trabajo
              </h2>
              {detail.exact_address ? (
                <div className="bg-canvas mt-3 rounded-2xl p-4 text-sm leading-6">
                  <strong className="block">{detail.exact_address}</strong>
                  {detail.access_notes ? (
                    <span className="text-ink/60">{detail.access_notes}</span>
                  ) : null}
                </div>
              ) : isClient &&
                ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
                  detail.job_status,
                ) ? (
                <form action={setJobLocationAction} className="mt-3 space-y-3">
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
                <p className="text-ink/55 mt-3 text-sm leading-6">
                  La dirección exacta se comparte sólo dentro del trabajo
                  confirmado y únicamente con sus participantes.
                </p>
              )}
            </section>
          ) : null}

          <section className="border-ink/10 rounded-3xl border bg-white/75 p-5">
            <h2 className="font-display text-xl font-semibold">Historial</h2>
            <ol className="mt-4 space-y-4">
              {events.map((event) => (
                <li key={event.event_id} className="relative pl-5 text-sm">
                  <span className="bg-moss absolute top-1.5 left-0 h-2 w-2 rounded-full" />
                  <strong className="block">
                    {event.event_type.replaceAll("_", " ")}
                  </strong>
                  <time className="text-ink/45 mt-0.5 block text-xs">
                    {dateTime(event.created_at)}
                  </time>
                  {event.reason ? (
                    <p className="text-ink/60 mt-1 leading-5">{event.reason}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
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
    <form
      action={transitionJobAction}
      className="border-ink/10 rounded-2xl border p-3"
    >
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
