import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ActionButton } from "@/components/ui/marketplace/action-button";
import {
  FormField,
  marketplaceInputClass,
  marketplaceTextareaClass,
} from "@/components/ui/marketplace/form-field";
import { createClient } from "@/lib/supabase/server";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { NeedsComingSoon } from "@/components/jobs/needs-coming-soon";
import { createNeedAction } from "../actions";

export const metadata = {
  title: "Publicar necesidad | YALO",
  description:
    "Contanos qué necesitás y recibí ofertas de prestadores verificados.",
};

export default async function NewNeedPage() {
  if (!arePublicNeedsEnabled()) return <NeedsComingSoon />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/needs/new");

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Publicar necesidad" backHref="/jobs" />
      <p className="text-ink/70 mt-2 text-[15px] leading-6">
        Describí el trabajo y compará ofertas de prestadores. Cuando aceptes
        una oferta, el pago se acuerda por fuera de YALO: efectivo o
        transferencia entre las partes.
      </p>
      <form
        action={createNeedAction}
        className="mt-6 flex flex-col gap-5"
      >
        <FormField
          label="¿Qué rubro necesitás?"
          helper="Elegí el rubro que mejor describa el trabajo."
        >
          <select
            name="skillId"
            required
            defaultValue=""
            className={marketplaceInputClass}
          >
            <option value="" disabled>
              Elegí un rubro
            </option>
            {(skills ?? []).map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Título"
          helper="Entre 10 y 120 caracteres. Ej: “Necesito plomero urgente en casa”."
        >
          <input
            name="title"
            required
            minLength={10}
            maxLength={120}
            placeholder="Resumí tu necesidad en una línea"
            className={marketplaceInputClass}
          />
        </FormField>
        <FormField
          label="Descripción"
          helper="Contá el detalle: qué hay que hacer, medidas, estado actual. Mínimo 20 caracteres."
        >
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={4000}
            placeholder="Describí el trabajo con el mayor detalle posible"
            className={marketplaceTextareaClass}
          />
        </FormField>
        <FormField
          label="Ubicación (opcional)"
          helper="Barrio o zona donde se hace el trabajo."
        >
          <input
            name="locationText"
            maxLength={200}
            placeholder="Ej: Palermo, CABA"
            className={marketplaceInputClass}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Inicio deseado (opcional)">
            <input
              name="scheduleStartAt"
              type="datetime-local"
              className={marketplaceInputClass}
            />
          </FormField>
          <FormField label="Fin deseado (opcional)">
            <input
              name="scheduleEndAt"
              type="datetime-local"
              className={marketplaceInputClass}
            />
          </FormField>
        </div>
        <FormField
          label="Presupuesto estimado en ARS (opcional)"
          helper="Un número orientativo; el precio final se negocia en cada oferta."
        >
          <input
            name="desiredBudgetAmount"
            inputMode="decimal"
            placeholder="Ej: 80.000"
            className={marketplaceInputClass}
          />
        </FormField>
        <ActionButton type="submit">Publicar necesidad</ActionButton>
      </form>
    </main>
  );
}
