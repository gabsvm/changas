import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatMinorUnits, type JobStatus } from "@changas/domain";

import {
  fakeAdditionalPaymentAction,
  fakeSettlementPaymentAction,
  requestRescheduleAction,
  requestScopeChangeAction,
  respondRescheduleAction,
  respondScopeChangeAction,
  setJobLocationAction,
  startJobSettlementCheckoutAction,
  transitionJobAction,
} from "@/app/(account)/jobs/actions";
import { JobReputationPanel } from "@/components/reputation/job-reputation-panel";
import { JobTracker } from "@/components/jobs/job-tracker";
import {
  getJobNextAction,
  getJobTracking,
  type NextAction,
} from "@/components/jobs/job-tracking";
import type { IllustratedIconName, IllustratedTone } from "@/components/ui/marketplace/illustrated-badge";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
import { SuccessCheck } from "@/components/ui/marketplace/success-check";
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
  if (!user) redirect(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);

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
  // Untyped RPC (mirrors lib/admin/server.ts): generated Database types do
  // not include is_current_user_admin.
  const { data: adminFlag } = await (
    supabase as unknown as {
      rpc(name: string): Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc("is_current_user_admin");
  const canSimulatePayment =
    process.env.NODE_ENV !== "production" || adminFlag === true;
  const schedulePrimary =
    detail.schedule_starts_at ?? detail.schedule_deadline_at ?? null;
  const status = getJobStatusPresentation(detail.job_status);
  const settlementPending = detail.settlement_status === "DUE";
  const tracking = getJobTracking(detail.job_status, detail.settlement_status);
  const nextAction = getJobNextAction({
    status: detail.job_status,
    isClient,
    isProvider,
    settlementPending,
  });
  const needsRescheduleAttention = reschedules.some(
    (request) =>
      request.request_status === "OPEN" &&
      request.requested_by_user_id !== user.id,
  );
  const needsScopeAttention = scopeChanges.some((change) =>
    ["OPEN", "AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(
      change.change_status,
    ),
  );
  const needsLocationAttention =
    isClient &&
    !detail.exact_address &&
    ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
      detail.job_status,
    );
  const showHelp = [
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETION_REQUESTED",
    "DISPUTED",
  ].includes(detail.job_status);
  const price = formatMinorUnits(
    detail.total_price_amount,
    detail.currency_code as "ARS",
  );
  const paidChanges = scopeChanges.filter(
    (change) => change.change_status === "PAID",
  );

  return (
    <section className="pb-28 sm:py-14">
      <MobileAppBar
        title="Seguimiento"
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
          <Link href="/jobs" className="text-ink/70 text-sm font-semibold">
            ← Mis trabajos
          </Link>
          <Link
            href={`/messages/${detail.conversation_id}`}
            className="consumer-pressable text-terracotta inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold"
          >
            Abrir conversación
          </Link>
        </div>

        {detail.job_status === "COMPLETED" ? (
          <div className="bg-success/[0.08] text-success mt-0 flex items-center gap-3 rounded-2xl px-4 py-4 sm:mt-5">
            <SuccessCheck className="h-10 w-10" />
            <div>
              <p className="text-[17px] leading-6 font-extrabold">
                ¡Trabajo completado!
              </p>
              <p className="text-ink/70 text-sm leading-5">
                Dejá tu reseña para ayudar a la próxima persona.
              </p>
            </div>
          </div>
        ) : null}

        <header className="consumer-card bg-surface mt-3 overflow-hidden sm:mt-5">
          <div
            className="relative h-20 overflow-hidden sm:h-24"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)",
            }}
            role="img"
            aria-label={`Ficha ilustrada de ${detail.service_title}`}
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
              className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-white/20"
              aria-hidden="true"
            />
            <span
              className="absolute -top-4 -left-4 h-14 w-14 rounded-full bg-white/15"
              aria-hidden="true"
            />
          </div>
          <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <StatusChip tone="neutral">
              {getServiceModalityLabel(detail.modality)}
            </StatusChip>
          </div>
          <h1 className="font-display mt-3 text-[22px] leading-8 font-extrabold tracking-[-0.025em]">
            {detail.service_title}
          </h1>
          <p className="text-ink/70 mt-1.5 text-sm leading-6">
            Con {detail.counterparty_name} · {price}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="border-ink/[0.08] bg-canvas rounded-2xl border p-3.5">
              <p className="text-ink/70 text-xs leading-4 font-semibold">
                Próxima fecha
              </p>
              <p className="mt-0.5 font-bold">
                {schedulePrimary
                  ? (dateTime(schedulePrimary) ?? "A coordinar")
                  : "A coordinar"}
              </p>
            </div>
            <div className="border-ink/[0.08] bg-canvas rounded-2xl border p-3.5">
              <p className="text-ink/70 text-xs leading-4 font-semibold">
                Precio acordado
              </p>
              <p className="mt-0.5 font-extrabold">{price}</p>
            </div>
          </div>
          </div>
        </header>

        <section
          className="border-ink/[0.08] bg-surface consumer-card mt-5 rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-5 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
          aria-label="Seguimiento del servicio"
        >
          <SectionHeader
            title="Seguimiento"
            badge={{ tone: "blue", icon: "clock", label: "Seguimiento" }}
          />
          <div className="mt-3">
            <JobTracker tracking={tracking} />
          </div>
          {isClient &&
          detail.confirmation_code &&
          ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
            detail.job_status,
          ) ? (
            <div className="border-ink/[0.08] bg-canvas mt-3 rounded-2xl border p-4 text-center">
              <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.12em] uppercase">
                Código para el prestador
              </p>
              <p
                className="font-display mt-1 text-3xl font-extrabold tracking-[0.25em]"
                aria-label={`Código de confirmación ${detail.confirmation_code}`}
              >
                {detail.confirmation_code}
              </p>
              <p className="text-ink/70 mt-1 text-xs leading-5">
                Compartilo cuando el trabajo esté terminado. Sin este código no
                se puede cerrar.
              </p>
            </div>
          ) : null}
          {isProvider && detail.job_status === "IN_PROGRESS" ? (
            <p className="text-ink/70 mt-3 text-xs leading-5">
              Para solicitar la finalización vas a necesitar el código de 4
              dígitos del cliente.
            </p>
          ) : null}
          {tracking.exception ? (
            <div className="border-warning/25 bg-warning/[0.06] mt-3 rounded-2xl border p-4">
              <h3 className="text-sm font-extrabold">{tracking.exception.title}</h3>
              <p className="text-ink/70 mt-1 text-[13px] leading-6">
                {tracking.exception.description}
              </p>
            </div>
          ) : null}
        </section>

        <section
          id="proxima-accion"
          className="brand-gradient-surface relative mt-5 scroll-mt-20 overflow-hidden rounded-2xl p-5 text-white shadow-[0_4px_10px_rgb(255_107_53/14%),0_30px_64px_-18px_rgb(255_87_34/46%)] dark:shadow-[0_30px_64px_-18px_rgb(0_0_0/70%)]"
          aria-label="Qué sigue"
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
              backgroundSize: "12px 12px",
            }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-white/20"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -top-4 -left-4 h-14 w-14 rounded-full bg-white/15"
            aria-hidden="true"
          />
          <p className="relative text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">
            Qué sigue
          </p>
          <h2 className="font-display relative mt-1 text-lg leading-7 font-extrabold">
            {nextAction.heading}
          </h2>
          <p className="relative mt-1 text-sm leading-6 text-white/85">
            {nextAction.sub}
          </p>
          <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
            <PrimaryAction jobId={jobId} kind={nextAction.kind} />
            <Link
              href={`/messages/${detail.conversation_id}`}
              className="consumer-pressable inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-bold text-white"
            >
              Ver chat
            </Link>
          </div>
        </section>

        {detail.settlement_status !== "NOT_DUE" ? (
          <div className="mt-5">
            <JobSection
              title="Pago del trabajo"
              badge={{ tone: "green", icon: "tag" }}
            >
              {detail.settlement_status === "SETTLED" ? (
                <p className="text-sm leading-7">
                  <strong>
                    Pagado{" "}
                    {formatMinorUnits(
                      detail.settlement_total_minor,
                      detail.currency_code as "ARS",
                    )}
                  </strong>
                  {isClient
                    ? " · Gracias por tu pago."
                    : " · El cliente completó el pago."}
                </p>
              ) : detail.settlement_status === "NOT_REQUIRED" ? (
                <p className="text-ink/70 text-sm leading-7">
                  Este trabajo no tiene cargos a cobrar.
                </p>
              ) : isClient ? (
                <>
                  <dl className="space-y-1 text-sm leading-6">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/70">Precio base</dt>
                      <dd className="font-bold">
                        {formatMinorUnits(
                          detail.base_price_amount,
                          detail.currency_code as "ARS",
                        )}
                      </dd>
                    </div>
                    {detail.settlement_unpaid_extras_minor > 0 ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink/70">Adicionales pendientes</dt>
                        <dd className="font-bold">
                          {formatMinorUnits(
                            detail.settlement_unpaid_extras_minor,
                            detail.currency_code as "ARS",
                          )}
                        </dd>
                      </div>
                    ) : null}
                    <div className="border-ink/10 flex justify-between gap-3 border-t pt-1">
                      <dt className="font-extrabold">Total a pagar</dt>
                      <dd className="font-extrabold">
                        {formatMinorUnits(
                          detail.settlement_total_minor,
                          detail.currency_code as "ARS",
                        )}
                      </dd>
                    </div>
                  </dl>
                  <form
                    action={startJobSettlementCheckoutAction}
                    className="mt-3"
                  >
                    <input type="hidden" name="jobId" value={jobId} />
                    <button className="consumer-pressable cta-ink inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-extrabold">
                      Pagar con Mercado Pago
                    </button>
                  </form>
                  <p className="text-ink/70 mt-2 text-xs leading-5">
                    Serás redirigido a Mercado Pago para completar el pago de
                    forma segura.
                  </p>
                  {canSimulatePayment ? (
                    <form
                      action={fakeSettlementPaymentAction}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input type="hidden" name="jobId" value={jobId} />
                      <input
                        type="hidden"
                        name="paymentNonce"
                        value={crypto.randomUUID()}
                      />
                      <button
                        name="outcome"
                        value="SUCCESS"
                        className="button-secondary text-xs"
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
                </>
              ) : (
                <p className="text-sm leading-7">
                  Pendiente de cobro:{" "}
                  <strong>
                    {formatMinorUnits(
                      detail.settlement_total_minor,
                      detail.currency_code as "ARS",
                    )}
                  </strong>{" "}
                  · el cliente lo paga al completar el trabajo.
                </p>
              )}
            </JobSection>
          </div>
        ) : null}

        <div className="mt-5">
          <JobSection
            title="Alcance acordado"
            badge={{ tone: "gold", icon: "doc" }}
            collapsible
            description="Lo acordado al contratar. Solo cambia si aceptás un adicional."
          >
            <p className="text-sm leading-7 whitespace-pre-wrap">
              {detail.scope_snapshot}
            </p>
            {paidChanges.length > 0 ? (
              <div className="mt-3 space-y-2">
                {paidChanges.map((change) => (
                  <p
                    key={change.scope_change_id}
                    className="border-ink/[0.08] bg-ink/[0.03] rounded-xl border px-3 py-2 text-sm leading-6 whitespace-pre-wrap dark:bg-white/[0.04]"
                  >
                    <span className="text-moss text-xs font-extrabold tracking-[0.06em] uppercase">Acordado después · </span>
                    {change.scope_snapshot}
                  </p>
                ))}
                <p className="text-ink/70 text-xs leading-5">
                  Base {formatMinorUnits(detail.base_price_amount, detail.currency_code as "ARS")} + adicionales pagados{" "}
                  {formatMinorUnits(detail.paid_additional_amount, detail.currency_code as "ARS")} ={" "}
                  <strong className="text-ink">total {price}</strong>
                </p>
              </div>
            ) : null}
          </JobSection>
        </div>

        <div id="resena" className="mt-5 scroll-mt-20">
          <JobReputationPanel
            jobId={jobId}
            status={detail.job_status}
            isClient={isClient}
            isProvider={isProvider}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-8">
            {showHelp ? (
              <JobSection
                title="Ayuda con este servicio"
                badge={{ tone: "rose", icon: "alert" }}
                description="Si algo sale mal, reportalo: revisamos el caso con ambas partes."
                collapsible={detail.job_status !== "DISPUTED"}
              >
              {["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
                detail.job_status,
              ) ? (
                <>
                  <div className="border-danger/25 bg-danger/[0.04] rounded-2xl border p-4">
                    <h3 className="text-sm font-extrabold">
                      ¿Algo salió mal con este trabajo?
                    </h3>
                    <ol className="text-ink/70 mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-6">
                      <li>Contanos qué pasó en el motivo de abajo.</li>
                      <li>Revisamos el caso con ambas partes.</li>
                      <li>Definimos el cierre: completar o cancelar el trabajo.</li>
                    </ol>
                    <div className="mt-3">
                      <ReasonTransitionForm
                        jobId={jobId}
                        expected={detail.job_status}
                        requested="DISPUTED"
                        label="Reportar problema"
                      />
                    </div>
                  </div>
                  <details className="border-ink/10 mt-3 border-t pt-3">
                    <summary className="consumer-pressable min-h-11 cursor-pointer py-3 text-sm font-semibold">
                      Cancelar o registrar ausencia
                    </summary>
                    <div className="grid gap-3 pb-2 sm:grid-cols-2">
                      <ReasonTransitionForm
                        jobId={jobId}
                        expected={detail.job_status}
                        requested="CANCELLED"
                        label="Cancelar trabajo"
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
                </>
              ) : null}
              {detail.job_status === "DISPUTED" ? (
                <div className="border-warning/25 bg-warning/[0.06] rounded-2xl border p-4">
                  <h3 className="text-sm font-extrabold">Caso en revisión</h3>
                  <p className="text-ink/70 mt-1 text-[13px] leading-6">
                    El equipo de Changas está revisando lo reportado y va a definir el cierre: completar o cancelar el trabajo.
                  </p>
                </div>
              ) : null}
            </JobSection>
            ) : null}

            {detail.job_status === "CONFIRMED" ? (
              <JobSection
                title="Reprogramar"
                badge={{ tone: "blue", icon: "calendar" }}
                collapsible
                defaultOpen={needsRescheduleAttention}
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
                          <p className="text-ink/70 mt-1">
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
                                className="consumer-pressable cta-ink inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-extrabold"
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
                badge={{ tone: "violet", icon: "sliders" }}
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
              <JobSection
                title="Adicionales y cambios"
                badge={{ tone: "gold", icon: "doc" }}
                collapsible
                defaultOpen={needsScopeAttention}
                description="Cambios de alcance propuestos y su estado de pago."
              >
                <div className="divide-ink/10 divide-y">
                  {scopeChanges.map((change) => {
                    const state = scopeStatus(change.change_status);
                    return (
                      <article key={change.scope_change_id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <StatusChip tone={state.tone}>
                            {state.label}
                          </StatusChip>
                          <span className="text-ink/70 text-xs">
                            {dateTime(change.created_at)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">
                          {change.scope_snapshot}
                        </p>
                        <div className="text-ink/70 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
                              detail.total_price_amount +
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
                              className="consumer-pressable cta-ink inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-extrabold"
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
                        canSimulatePayment &&
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
                              className="consumer-pressable cta-ink inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-extrabold"
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
              <JobSection
                title="Ubicación del trabajo"
                badge={{ tone: "green", icon: "pin" }}
                collapsible={!needsLocationAttention}
              >
                {detail.exact_address ? (
                  <div className="text-sm leading-6">
                    <strong className="block">{detail.exact_address}</strong>
                    {detail.access_notes ? (
                      <span className="text-ink/70">{detail.access_notes}</span>
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
                  <p className="text-ink/70 text-sm leading-6">
                    La dirección exacta se comparte sólo dentro del trabajo
                    confirmado y únicamente con sus participantes.
                  </p>
                )}
              </JobSection>
            ) : null}

            <JobSection
              title="Historial"
              badge={{ tone: "neutral", icon: "clock" }}
              collapsible
              description="Todo lo que pasó en este servicio, en orden."
            >
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
                          <p className="text-ink/70 mt-1.5 leading-6">
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
      <div className="bg-surface/95 border-ink/10 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto] items-center gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            {nextAction.kind ? (
              <PrimaryAction jobId={jobId} kind={nextAction.kind} compact />
            ) : (
              <a
                href="#proxima-accion"
                className="consumer-pressable inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-sm font-bold"
              >
                Ver qué sigue
              </a>
            )}
          </div>
          <Link
            href={`/messages/${detail.conversation_id}`}
            className="consumer-pressable inline-flex min-h-[52px] items-center justify-center rounded-xl border border-ink/10 px-4 text-sm font-bold"
            aria-label="Abrir chat del servicio"
          >
            Chat
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink/42 text-[11px] font-bold tracking-[0.08em] uppercase">
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
  defaultOpen = false,
  badge,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: { tone: IllustratedTone; icon: IllustratedIconName };
}) {
  if (collapsible) {
    return (
      <details
        open={defaultOpen || undefined}
        className="border-ink/[0.08] bg-surface consumer-card rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-5 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
      >
        <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <SectionHeader
            title={title}
            badge={badge ?? { tone: "neutral", icon: "doc", label: title }}
          />
          <span className="text-ink/40 shrink-0 text-xl" aria-hidden="true">
            ›
          </span>
        </summary>
        {description ? (
          <p className="text-ink/70 mt-1.5 text-sm leading-6">{description}</p>
        ) : null}
        <div className="mt-3 pb-1">{children}</div>
      </details>
    );
  }
  return (
    <section className="border-ink/[0.08] bg-surface consumer-card rounded-2xl border p-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] sm:p-5 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
      <SectionHeader
        title={title}
        badge={badge ?? { tone: "neutral", icon: "doc", label: title }}
      />
      {description ? (
        <p className="text-ink/70 mt-1.5 text-sm leading-6">{description}</p>
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
      <button className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold">{label}</button>
    </form>
  );
}

function PrimaryAction({
  jobId,
  kind,
  compact = false,
}: {
  jobId: string;
  kind: NextAction["kind"];
  compact?: boolean;
}) {
  if (kind === "start") {
    return (
      <StatusButton
        jobId={jobId}
        expected="CONFIRMED"
        requested="IN_PROGRESS"
        label="Iniciar trabajo"
      />
    );
  }
  if (kind === "request_completion") {
    if (compact) {
      return (
        <a
          href="#proxima-accion"
          className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
        >
          Ingresar código
        </a>
      );
    }
    return (
      <form action={transitionJobAction} className="grid gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="expectedStatus" value="IN_PROGRESS" />
        <input type="hidden" name="requestedStatus" value="COMPLETION_REQUESTED" />
        <label className="text-[13px] font-bold text-white/90">
          Código del cliente
          <input
            name="confirmationCode"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            pattern="[0-9]{4}"
            placeholder="4 dígitos"
            className="mt-1.5 h-[52px] w-full rounded-xl border border-white/25 bg-white/10 px-4 text-center text-lg font-extrabold tracking-[0.3em] text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-white/50"
          />
        </label>
        <button className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold">
          Solicitar finalización
        </button>
      </form>
    );
  }
  if (kind === "confirm_completion") {
    return (
      <StatusButton
        jobId={jobId}
        expected="COMPLETION_REQUESTED"
        requested="COMPLETED"
        label="Confirmar finalización"
      />
    );
  }
  if (kind === "pay") {
    return (
      <form action={startJobSettlementCheckoutAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <button className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold">
          Pagar con Mercado Pago
        </button>
      </form>
    );
  }
  if (kind === "review") {
    return (
      <Link
        href="#resena"
        className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
      >
        Dejar reseña
      </Link>
    );
  }
  return null;
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
