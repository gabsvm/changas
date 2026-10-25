import { requestCorrectionAction } from "@/app/(account)/jobs/actions";

export function CorrectionForm({ jobId }: { jobId: string }) {
  return (
    <details className="mt-2 rounded-xl border border-white/25">
      <summary className="consumer-pressable min-h-[52px] cursor-pointer px-4 py-3 text-sm font-bold text-white">
        Pedir corrección
      </summary>
      <form action={requestCorrectionAction} className="grid gap-2 p-4 pt-0">
        <input type="hidden" name="jobId" value={jobId} />
        <label className="text-[13px] font-bold text-white/90">
          Qué hay que corregir
          <textarea
            name="correctionReason"
            required
            minLength={2}
            maxLength={1000}
            rows={3}
            placeholder="Contale al prestador qué ajustar"
            className="mt-1.5 w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white outline-none placeholder:font-normal placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/70"
          />
        </label>
        <button className="consumer-pressable inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-bold text-white">
          Enviar corrección
        </button>
        <p className="text-xs leading-5 text-white/75">
          El trabajo vuelve a curso y el prestador envía una nueva versión. El
          historial se conserva.
        </p>
      </form>
    </details>
  );
}
