"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { formatServicePrice, minorUnitsToMajorInput } from "@changas/domain";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import { compressInputFiles } from "@/lib/media/image-compression";
import { animateConfirmedSave } from "@/lib/ui/panel-motion";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  IllustratedBadge,
  type IllustratedIconName,
  type IllustratedTone,
} from "@/components/ui/marketplace/illustrated-badge";

type ProviderAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;
type Tables = Database["public"]["Tables"];
type Row<K extends keyof Tables> = Tables[K]["Row"];

type Provider = Pick<
  Row<"provider_profiles">,
  | "status"
  | "public_slug"
  | "public_headline"
  | "marketplace_paused"
  | "availability_paused"
>;
type Skill = Pick<Row<"skills">, "id" | "name" | "slug" | "category_id"> & {
  category_name: string;
};
type ProviderSkill = Pick<
  Row<"provider_skills">,
  "skill_id" | "is_featured" | "sort_order"
>;

type Service = Row<"services">;
type Experience = Row<"experiences">;
type Education = Row<"education">;
type Certification = Row<"certifications">;
type PortfolioItem = Row<"portfolio_items">;
type ServiceArea = Row<"service_areas">;
type AvailabilityRule = Row<"availability_rules">;
type AvailabilityBlock = Row<"availability_blocks">;

function ActionForm({
  action,
  children,
  submitLabel,
  encType,
  directUpload,
  className = "space-y-4",
}: {
  action: ProviderAction;
  children: React.ReactNode;
  submitLabel: string;
  encType?: "multipart/form-data";
  directUpload?: { bucket: string; fieldName: string };
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const successRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [directMetadata, setDirectMetadata] = useState<{
    path: string;
    mimeType: string;
    size: number;
  } | null>(null);

  useEffect(() => {
    // The form is submitted manually (see handleSubmit), so React does not
    // reset it; clear it only once the save succeeded.
    if (state.success) formRef.current?.reset();
    if (!successRef.current) return;
    return animateConfirmedSave(successRef.current, state.success);
  }, [state]);

  async function handleFileChange(event: React.ChangeEvent<HTMLFormElement>) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    setCompressing(true);
    setCompressionError(null);
    setDirectMetadata(null);
    try {
      await compressInputFiles(input);
      const file = input.files?.[0];
      if (!file || !directUpload) return;
      setUploading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "media";
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage
        .from(directUpload.bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error("No pudimos subir el archivo privado.");
      input.value = "";
      setDirectMetadata({ path, mimeType: file.type, size: file.size });
    } catch (error) {
      input.value = "";
      setCompressionError(
        error instanceof Error
          ? error.message
          : "No pudimos optimizar la imagen.",
      );
    } finally {
      setUploading(false);
      setCompressing(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Passing `action` to <form> makes React 19 reset every field after the
    // action settles, even on validation errors. Dispatch manually so a failed
    // save keeps what the user typed.
    event.preventDefault();
    if (compressing || uploading) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      encType={encType}
      className={className}
      onChange={handleFileChange}
      onSubmit={handleSubmit}
    >
      {children}
      {directMetadata && directUpload ? (
        <>
          <input
            type="hidden"
            name={`${directUpload.fieldName}Path`}
            value={directMetadata.path}
          />
          <input
            type="hidden"
            name={`${directUpload.fieldName}MimeType`}
            value={directMetadata.mimeType}
          />
          <input
            type="hidden"
            name={`${directUpload.fieldName}SizeBytes`}
            value={directMetadata.size}
          />
        </>
      ) : null}
      <button
        className="button-primary disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending || compressing || uploading}
      >
        {compressing
          ? "Optimizando…"
          : uploading
            ? "Subiendo archivo…"
            : pending
              ? "Guardando…"
              : submitLabel}
      </button>
      {state.error ? (
        <p
          className="bg-terracotta/10 text-terracotta rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          ref={successRef}
          data-motion-save
          className="bg-moss/10 text-moss rounded-xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {state.success}
        </p>
      ) : null}
      {compressionError ? (
        <p
          className="bg-terracotta/10 text-terracotta rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {compressionError}
        </p>
      ) : null}
    </form>
  );
}

function DeleteForm({
  action,
  recordId,
}: {
  action: ProviderAction;
  recordId: string;
}) {
  return (
    <ActionForm action={action} submitLabel="Eliminar" className="mt-3">
      <input type="hidden" name="recordId" value={recordId} />
    </ActionForm>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  helper,
  min,
  max,
  step,
  minLength,
  maxLength,
  disabled = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null | undefined;
  type?: string;
  required?: boolean;
  helper?: string | undefined;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        className="border-ink/15 focus:border-moss focus:ring-moss/20 disabled:bg-ink/[0.04] disabled:text-ink/40 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        min={min}
        max={max}
        step={step}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
      />
      {helper ? (
        <span className="text-ink/70 mt-1.5 block text-xs leading-5 font-normal">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  required = false,
  minLength,
  maxLength,
  helper,
}: {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  helper?: string | undefined;
}) {
  const [length, setLength] = useState(String(defaultValue ?? "").length);
  return (
    <label className="text-sm font-semibold">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {maxLength || minLength ? (
          <span
            className={`text-xs font-normal ${length < (minLength ?? 0) ? "text-terracotta" : "text-ink/70"}`}
          >
            {length}
            {maxLength
              ? `/${maxLength}`
              : minLength
                ? ` (mín. ${minLength})`
                : ""}
          </span>
        ) : null}
      </span>
      <textarea
        className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 min-h-24 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        onChange={(event) => setLength(event.target.value.length)}
      />
      {helper ? (
        <span className="text-ink/70 mt-1.5 block text-xs leading-5 font-normal">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function Check({
  label,
  name,
  defaultChecked = false,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean | undefined;
}) {
  return (
    <label className="text-ink/75 flex items-center gap-2 text-sm">
      <input
        className="accent-moss h-4 w-4"
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
      />
      {label}
    </label>
  );
}

const SECTION_BADGES: Record<string, { tone: IllustratedTone; icon: IllustratedIconName }> = {
  perfil: { tone: "violet", icon: "user" },
  habilidades: { tone: "blue", icon: "sparkle" },
  servicios: { tone: "orange", icon: "briefcase" },
  experiencia: { tone: "gold", icon: "star" },
  formacion: { tone: "green", icon: "doc" },
  certificaciones: { tone: "rose", icon: "check" },
  portfolio: { tone: "orange", icon: "image" },
  zonas: { tone: "green", icon: "pin" },
  disponibilidad: { tone: "blue", icon: "calendar" },
};
const PORTFOLIO_COVERS = [
  "linear-gradient(135deg, #FF9A3D 0%, #EE5A24 100%)",
  "linear-gradient(135deg, #4F8DFF 0%, #2F4BFE 100%)",
  "linear-gradient(135deg, #2FBF71 0%, #0E7C46 100%)",
  "linear-gradient(135deg, #8B7CFF 0%, #5B4BD6 100%)",
  "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)",
  "linear-gradient(135deg, #FB6F92 0%, #E14D7A 100%)",
];

function Section({
  eyebrow,
  title,
  description,
  anchor,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  anchor?: string;
  children: React.ReactNode;
}) {
  const badge: { tone: IllustratedTone; icon: IllustratedIconName } =
    (anchor ? SECTION_BADGES[anchor] : undefined) ?? {
      tone: "neutral",
      icon: "sparkle",
    };
  return (
    <section
      id={anchor}
      className="border-ink/10 consumer-card scroll-mt-32 overflow-hidden rounded-2xl border bg-white/65 dark:border-white/10 dark:bg-[#2a231c]"
    >
      <span
        className="brand-gradient-surface pointer-events-none block h-1.5"
        aria-hidden="true"
      />
      <div className="p-5 sm:p-7">
      <div className="flex min-w-0 items-center gap-2.5">
        <IllustratedBadge tone={badge.tone} icon={badge.icon} size="sm" label={title} />
        <p className="text-terracotta min-w-0 truncate text-xs font-semibold tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
      </div>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="text-ink/70 mt-2 max-w-3xl text-sm leading-6">
        {description}
      </p>
      <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function ServiceForm({
  action,
  service,
  skills,
  serviceTags,
}: {
  action: ProviderAction;
  service?: Service;
  skills: Skill[];
  serviceTags: string[];
}) {
  const [priceModel, setPriceModel] = useState<string>(
    service?.price_model ?? "FIXED",
  );
  const isQuote = priceModel === "QUOTE";
  const isPerUnit = priceModel === "PER_UNIT";
  return (
    <ActionForm
      action={action}
      submitLabel={service ? "Actualizar servicio" : "Agregar servicio"}
    >
      {service ? (
        <input type="hidden" name="serviceId" value={service.id} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Habilidad asociada
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
            name="skillId"
            defaultValue={service?.skill_id ?? skills[0]?.id}
            required
          >
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.category_name} · {skill.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Título público (mín. 3 caracteres)"
          name="title"
          defaultValue={service?.title}
          required
          minLength={3}
          maxLength={120}
        />
      </div>
      <TextArea
        label="Descripción"
        name="description"
        defaultValue={service?.description}
        required
        minLength={20}
        maxLength={3000}
        helper="Contá qué incluye el trabajo: mínimo 20 caracteres."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Modalidad
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
            name="modality"
            defaultValue={service?.modality ?? "REMOTE"}
          >
            <option value="IN_PERSON">Presencial</option>
            <option value="REMOTE">Remoto</option>
            <option value="BOTH">Ambos</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Modelo de precio
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
            name="priceModel"
            value={priceModel}
            onChange={(event) => setPriceModel(event.target.value)}
          >
            <option value="FIXED">Precio fijo</option>
            <option value="STARTING_AT">Desde</option>
            <option value="HOURLY">Por hora</option>
            <option value="PER_UNIT">Por unidad</option>
            <option value="QUOTE">A cotizar</option>
          </select>
        </label>
        <div key={`amount-${priceModel}`}>
          <Field
            label={isQuote ? "Monto (no aplica a cotizar)" : "Monto en ARS"}
            name="priceAmount"
            type="number"
            min={1}
            step="0.01"
            defaultValue={
              isQuote
                ? ""
                : service
                  ? minorUnitsToMajorInput(service.price_amount)
                  : ""
            }
            disabled={isQuote}
            required={!isQuote}
            helper={isQuote ? "“A cotizar” no lleva monto." : undefined}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Moneda
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
            name="currencyCode"
            defaultValue="ARS"
          >
            <option value="ARS">ARS · Peso argentino</option>
          </select>
        </label>
        <div key={`unit-${priceModel}`}>
          <Field
            label={
              isPerUnit ? "Unidad (requerida)" : "Unidad (sólo por unidad)"
            }
            name="priceUnit"
            defaultValue={isPerUnit ? service?.price_unit : ""}
            disabled={!isPerUnit}
            required={isPerUnit}
            helper={
              isPerUnit
                ? "Ej: hora, metro, unidad, equipo."
                : "Se habilita con “Por unidad”."
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Check
          label="Acepta propuestas"
          name="acceptsOffers"
          defaultChecked={service?.accepts_offers}
        />
        <Check
          label="Publicado"
          name="isPublished"
          defaultChecked={service?.is_published}
        />
        <Check
          label="Pausado"
          name="isPaused"
          defaultChecked={service?.is_paused}
        />
      </div>
      <details className="border-ink/10 rounded-xl border bg-white/60 px-3 py-1 dark:border-white/10 dark:bg-[#2a231c]">
        <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center text-sm font-bold">
          Más detalles (opcional)
        </summary>
        <div className="space-y-4 pt-2 pb-3">
          <Field
            label="Duración en minutos"
            name="expectedDurationMinutes"
            type="number"
            min={1}
            defaultValue={service?.expected_duration_minutes}
          />
          <Field
            label="Tags (separados por comas, hasta 8)"
            name="tags"
            defaultValue={serviceTags.join(", ")}
          />
          <label className="text-sm font-semibold">
            Agenda
            <select
              className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
              name="scheduleType"
              defaultValue={service?.schedule_type ?? "UNSCHEDULED"}
            >
              <option value="FIXED_SLOT">Horario fijo</option>
              <option value="FLEXIBLE_WINDOW">Ventana flexible</option>
              <option value="DEADLINE">Con fecha límite</option>
              <option value="UNSCHEDULED">Sin agenda todavía</option>
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <TextArea
              label="Incluye"
              name="includes"
              defaultValue={service?.includes}
            />
            <TextArea
              label="No incluye"
              name="excludes"
              defaultValue={service?.excludes}
            />
            <TextArea
              label="Materiales y notas"
              name="materialsNotes"
              defaultValue={service?.materials_notes}
            />
          </div>
        </div>
      </details>
    </ActionForm>
  );
}

function ProfessionalRecordList({
  records,
  deleteAction,
  empty,
  render,
}: {
  records: { id: string }[];
  deleteAction: ProviderAction;
  empty: string;
  render: (record: { id: string }) => React.ReactNode;
}) {
  return records.length ? (
    <div className="grid gap-3 md:grid-cols-2">
      {records.map((record) => (
        <article
          className="border-ink/10 rounded-xl border bg-white/60 p-4 dark:border-white/10 dark:bg-[#2a231c]"
          key={record.id}
        >
          {render(record)}
          <DeleteForm action={deleteAction} recordId={record.id} />
        </article>
      ))}
    </div>
  ) : (
    <p className="text-ink/70 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
      {empty}
    </p>
  );
}

export function MarketplaceManagement({
  provider,
  skills,
  catalogSkills,
  providerSkills,
  services,
  serviceTagsByServiceId,
  experiences,
  education,
  certifications,
  portfolioItems,
  serviceAreas,
  availabilityRules,
  availabilityBlocks,
  suggestedSlug,
  actions,
}: {
  suggestedSlug?: string | undefined;
  provider: Provider;
  skills: Skill[];
  catalogSkills: Skill[];
  providerSkills: ProviderSkill[];
  services: Service[];
  serviceTagsByServiceId: Record<string, string[]>;
  experiences: Experience[];
  education: Education[];
  certifications: Certification[];
  portfolioItems: PortfolioItem[];
  serviceAreas: ServiceArea[];
  availabilityRules: AvailabilityRule[];
  availabilityBlocks: AvailabilityBlock[];
  actions: {
    settings: ProviderAction;
    saveSkill: ProviderAction;
    removeSkill: ProviderAction;
    saveService: ProviderAction;
    pauseService: ProviderAction;
    deleteService: ProviderAction;
    saveExperience: ProviderAction;
    deleteExperience: ProviderAction;
    saveEducation: ProviderAction;
    deleteEducation: ProviderAction;
    saveCertification: ProviderAction;
    deleteCertification: ProviderAction;
    savePortfolio: ProviderAction;
    deletePortfolio: ProviderAction;
    saveArea: ProviderAction;
    deleteArea: ProviderAction;
    saveRule: ProviderAction;
    deleteRule: ProviderAction;
    saveBlock: ProviderAction;
    deleteBlock: ProviderAction;
  };
}) {
  const categoryName = new Map(
    catalogSkills.map((skill) => [skill.id, skill.category_name]),
  );
  const skillName = new Map(
    catalogSkills.map((skill) => [skill.id, skill.name]),
  );
  const [activeSection, setActiveSection] = useState("perfil");
  return (
    <div className="space-y-6">
      <nav
        className="consumer-scrollbar-none bg-canvas/97 sticky top-14 z-20 -mx-4 flex gap-2 overflow-x-auto px-4 py-2 backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none"
        aria-label="Secciones de gestión"
      >
        {(
          [
            ["perfil", "Perfil"],
            ["habilidades", "Habilidades"],
            ["servicios", "Servicios"],
            ["experiencia", "Experiencia"],
            ["formacion", "Formación"],
            ["certificaciones", "Certificaciones"],
            ["portfolio", "Portfolio"],
            ["zonas", "Zonas"],
            ["disponibilidad", "Disponibilidad"],
          ] as Array<[string, string]>
        ).map(([id, label]) => {
          const active = activeSection === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActiveSection(id)}
              aria-current={active ? "true" : undefined}
              className={`consumer-pressable inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-bold transition-all duration-200 ${
                active
                  ? "border-transparent text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)]"
                  : "border-ink/[0.08] border bg-white dark:border-white/10 dark:bg-[#2a231c] dark:text-[#f5efe8]"
              }`}
              style={
                active
                  ? {
                      backgroundImage:
                        "linear-gradient(135deg, #FF9A3D 0%, #FF6B35 48%, #FF0A78 100%)",
                    }
                  : undefined
              }
            >
              {label}
            </a>
          );
        })}
      </nav>
      <Section
        anchor="perfil"
        eyebrow="Perfil público"
        title="Tu escaparate, bajo tu control"
        description="Editá sólo la información que querés publicar. La identidad privada y los documentos de onboarding quedan fuera de esta pantalla."
      >
        <ActionForm
          action={actions.settings}
          submitLabel="Guardar perfil público"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Enlace de tu perfil"
              name="publicSlug"
              defaultValue={
                provider.public_slug.startsWith("provider-") && suggestedSlug
                  ? suggestedSlug
                  : provider.public_slug
              }
              required
              helper="Es el enlace que vas a compartir: /p/tu-nombre. Guardá el perfil para usar el sugerido."
            />
            <Field
              label="Titular público"
              name="publicHeadline"
              defaultValue={provider.public_headline}
            />
          </div>
          <div className="flex flex-wrap gap-5">
            <Check
              label="Pausar todo el perfil"
              name="marketplacePaused"
              defaultChecked={provider.marketplace_paused}
            />
            <Check
              label="Pausar disponibilidad"
              name="availabilityPaused"
              defaultChecked={provider.availability_paused}
            />
          </div>
          <p className="text-ink/70 text-xs">
            {provider.status === "ACTIVE"
              ? "Tu identidad está verificada: podés publicar servicios."
              : "Tu identidad todavía no está verificada: podés preparar servicios, pero se publican cuando la verificación esté aprobada."}
          </p>
        </ActionForm>
      </Section>

      <Section
        anchor="habilidades"
        eyebrow="Lo que sabés hacer"
        title="Habilidades que ofrecés"
        description="Elegí tus habilidades de la lista. Después las usás para armar servicios concretos con precio."
      >
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <ActionForm
            action={actions.saveSkill}
            submitLabel="Agregar habilidad"
          >
            <label className="text-sm font-semibold">
              Habilidad
              <select
                className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="skillId"
                defaultValue={catalogSkills[0]?.id}
                required
              >
                {catalogSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.category_name} · {skill.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="sortOrder" value="10" />
            <Check label="Destacar en mi perfil" name="isFeatured" />
          </ActionForm>
          <div className="space-y-3">
            {providerSkills.length ? (
              providerSkills.map((item) => (
                <div
                  className="border-ink/10 flex items-center justify-between gap-3 rounded-xl border bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-[#2a231c]"
                  key={item.skill_id}
                >
                  <div>
                    <p className="font-semibold">
                      {skillName.get(item.skill_id) ?? "Habilidad"}
                    </p>
                    <p className="text-ink/70 text-xs">
                      {categoryName.get(item.skill_id) ?? "Catálogo"}
                      {item.is_featured ? " · destacada" : ""}
                    </p>
                  </div>
                  <DeleteForm
                    action={actions.removeSkill}
                    recordId={item.skill_id}
                  />
                </div>
              ))
            ) : (
              <p className="text-ink/70 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
                Todavía no agregaste habilidades.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        anchor="servicios"
        eyebrow="Servicios"
        title="Ofertas concretas"
        description="Cada servicio tiene su precio (fijo, desde, por hora, por unidad o a cotizar) y su modalidad (presencial, remota o ambas). Podés pausarlos cuando quieras."
      >
        <div className="space-y-5">
          <details
            open={services.length === 0}
            className="border-ink/10 rounded-2xl border bg-white/45 px-4 py-3 dark:border-white/10 dark:bg-[#2a231c]"
          >
            <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
              + Nuevo servicio
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="pt-2">
              <ServiceForm
                action={actions.saveService}
                skills={catalogSkills}
                serviceTags={[]}
              />
            </div>
          </details>
          {services.map((service) => (
            <div
              className="border-ink/10 rounded-xl border bg-white/45 p-4 dark:border-white/10 dark:bg-[#2a231c]"
              key={service.id}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{service.title}</p>
                  <p className="text-ink/70 text-xs">
                    {service.public_slug} ·{" "}
                    {service.is_published ? "publicado" : "borrador"}
                    {service.is_paused ? " · pausado" : ""}
                  </p>
                </div>
                <span className="bg-moss/10 text-moss rounded-full px-3 py-1 text-xs font-semibold">
                  {formatServicePrice(
                    service.price_model,
                    service.price_amount,
                    service.currency_code,
                    service.price_unit,
                  )}
                </span>
                {service.is_paused ? (
                  <span className="bg-ink/[0.06] text-ink/70 rounded-full px-3 py-1 text-xs font-semibold">
                    Pausado
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionForm
                  action={actions.pauseService}
                  submitLabel={
                    service.is_paused ? "Reanudar servicio" : "Pausar servicio"
                  }
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input
                    type="hidden"
                    name="paused"
                    value={String(!service.is_paused)}
                  />
                </ActionForm>
              </div>
              <details className="border-ink/10 mt-3 border-t pt-2">
                <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
                  Editar servicio
                  <span className="text-ink/40 text-xl" aria-hidden="true">
                    ›
                  </span>
                </summary>
                <div className="pt-2">
                  <ServiceForm
                    action={actions.saveService}
                    service={service}
                    skills={skills}
                    serviceTags={serviceTagsByServiceId[service.id] ?? []}
                  />
                  <div className="border-ink/10 mt-3 border-t pt-2">
                    <DeleteForm
                      action={actions.deleteService}
                      recordId={service.id}
                    />
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          anchor="experiencia"
          eyebrow="Trayectoria"
          title="Experiencia"
          description="Mostrá experiencia pública o conservá registros privados para tu gestión."
        >
          <ProfessionalRecordList
            records={experiences}
            deleteAction={actions.deleteExperience}
            empty="No hay experiencias cargadas."
            render={(record) => {
              const item = record as Experience;
              return (
                <>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-ink/70 mt-1 text-sm">
                    {item.organization ?? "Sin organización"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                  <p className="text-ink/70 mt-2 text-sm">{item.description}</p>
                </>
              );
            }}
          />
          <details className="border-ink/10 mt-5 border-t pt-2">
            <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
              + Agregar experiencia
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="pt-3">
              <ActionForm
                action={actions.saveExperience}
                submitLabel="Agregar experiencia"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Puesto o rol" name="title" required />
                  <Field label="Organización" name="organization" />
                </div>
                <TextArea label="Descripción" name="description" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Desde" name="startedOn" type="date" required />
                  <Field label="Hasta" name="endedOn" type="date" />
                </div>
                <div className="flex flex-wrap gap-4">
                  <Check label="Actualmente" name="isCurrent" />
                  <Check label="Mostrar públicamente" name="isPublic" />
                </div>
              </ActionForm>
            </div>
          </details>
        </Section>
        <Section
          anchor="formacion"
          eyebrow="Formación"
          title="Educación"
          description="Compartí estudios relevantes sin exponer información privada de identidad."
        >
          <ProfessionalRecordList
            records={education}
            deleteAction={actions.deleteEducation}
            empty="No hay formación cargada."
            render={(record) => {
              const item = record as Education;
              return (
                <>
                  <p className="font-semibold">{item.institution}</p>
                  <p className="text-ink/70 mt-1 text-sm">
                    {item.field_of_study ?? "Campo no especificado"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                </>
              );
            }}
          />
          <details className="border-ink/10 mt-5 border-t pt-2">
            <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
              + Agregar formación
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="pt-3">
              <ActionForm
                action={actions.saveEducation}
                submitLabel="Agregar formación"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Institución" name="institution" required />
                  <Field label="Campo de estudio" name="fieldOfStudy" />
                </div>
                <TextArea label="Descripción" name="description" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Desde" name="startedOn" type="date" required />
                  <Field label="Hasta" name="endedOn" type="date" />
                </div>
                <Check label="Mostrar públicamente" name="isPublic" />
              </ActionForm>
            </div>
          </details>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          anchor="certificaciones"
          eyebrow="Certificaciones"
          title="Credenciales"
          description="La ficha pública puede mostrar el título y emisor; el archivo que adjuntes como prueba queda privado."
        >
          <ProfessionalRecordList
            records={certifications}
            deleteAction={actions.deleteCertification}
            empty="No hay certificaciones cargadas."
            render={(record) => {
              const item = record as Certification;
              return (
                <>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-ink/70 mt-1 text-sm">
                    {item.issuer ?? "Emisor no especificado"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                  <p className="text-ink/70 mt-2 text-xs">
                    {item.evidence_path
                      ? "Evidencia privada guardada"
                      : "Sin evidencia adjunta"}
                  </p>
                </>
              );
            }}
          />
          <details className="border-ink/10 mt-5 border-t pt-2">
            <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
              + Agregar certificación
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="pt-3">
              <ActionForm
                action={actions.saveCertification}
                submitLabel="Guardar certificación"
                encType="multipart/form-data"
                directUpload={{
                  bucket: "provider-certification-evidence",
                  fieldName: "evidence",
                }}
              >
                <Field label="Título" name="title" required />
                <Field label="Emisor" name="issuer" />
                <TextArea label="Descripción" name="description" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Emitida" name="issuedOn" type="date" />
                  <Field label="Vence" name="expiresOn" type="date" />
                </div>
                <label className="text-sm font-semibold">
                  Evidencia privada
                  <input
                    className="border-ink/20 mt-2 block w-full rounded-xl border border-dashed bg-white/70 px-3 py-3 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="evidence"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                  />
                </label>
                <Check label="Mostrar ficha públicamente" name="isPublic" />
              </ActionForm>
            </div>
          </details>
        </Section>
        <Section
          anchor="portfolio"
          eyebrow="Portfolio"
          title="Trabajo visible"
          description="Las piezas de portfolio pueden ser públicas sólo cuando vos las marcás así. Tus documentos de identidad nunca se mezclan con ellas."
        >
          {portfolioItems.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {portfolioItems.map((item, index) => (
                <li
                  key={item.id}
                  className="border-ink/[0.08] bg-surface consumer-card consumer-card-pressed consumer-pressable overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] transition-all duration-200 hover:-translate-y-0.5 dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
                >
                  <span
                    className="relative block h-16 overflow-hidden"
                    style={{
                      backgroundImage: PORTFOLIO_COVERS[index % PORTFOLIO_COVERS.length],
                    }}
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-0 opacity-25"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                        backgroundSize: "10px 10px",
                      }}
                    />
                    <span className="absolute -right-4 -bottom-6 h-16 w-16 rounded-full bg-white/20" />
                  </span>
                  <span className="block p-4">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="text-ink/70 mt-1 block text-sm">
                      {item.is_public ? "público" : "privado"}
                      {item.media_path
                        ? " · imagen guardada"
                        : " · ficha de texto"}
                    </span>
                    <span className="text-ink/70 mt-2 block text-sm">{item.description}</span>
                    <span className="mt-3 block">
                      <DeleteForm action={actions.deletePortfolio} recordId={item.id} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink/70 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
              No hay piezas de portfolio cargadas.
            </p>
          )}
          <details className="border-ink/10 mt-5 border-t pt-2">
            <summary className="consumer-pressable flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-extrabold">
              + Agregar pieza
              <span className="text-ink/40 text-xl" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="pt-3">
              <ActionForm
                action={actions.savePortfolio}
                submitLabel="Guardar pieza"
                encType="multipart/form-data"
                directUpload={{
                  bucket: "provider-portfolio",
                  fieldName: "media",
                }}
              >
                <Field label="Título" name="title" required />
                <TextArea label="Descripción" name="description" />
                <label className="text-sm font-semibold">
                  Imagen pública opcional
                  <input
                    className="border-ink/20 mt-2 block w-full rounded-xl border border-dashed bg-white/70 px-3 py-3 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="media"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <Check label="Publicar esta pieza" name="isPublic" />
              </ActionForm>
            </div>
          </details>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          anchor="zonas"
          eyebrow="Zonas"
          title="Área de servicio"
          description="Guardamos un centro exacto privado para futuras consultas geográficas, pero la vista pública sólo muestra etiqueta y radio aproximado."
        >
          <ProfessionalRecordList
            records={serviceAreas}
            deleteAction={actions.deleteArea}
            empty="No hay zonas cargadas."
            render={(record) => {
              const item = record as ServiceArea;
              return (
                <>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-ink/70 mt-1 text-sm">
                    Radio {item.radius_meters} m ·{" "}
                    {item.is_active ? "activa" : "inactiva"}
                  </p>
                </>
              );
            }}
          />
          <div className="border-ink/10 mt-5 border-t pt-5">
            <ActionForm action={actions.saveArea} submitLabel="Agregar zona">
              <Field label="Etiqueta pública" name="label" required />
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Latitud privada"
                  name="latitude"
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  required
                />
                <Field
                  label="Longitud privada"
                  name="longitude"
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  required
                />
                <Field
                  label="Radio en metros"
                  name="radiusMeters"
                  type="number"
                  min={100}
                  max={100000}
                  required
                />
              </div>
              <Check label="Zona activa" name="isActive" defaultChecked />
            </ActionForm>
          </div>
        </Section>
        <Section
          anchor="disponibilidad"
          eyebrow="Disponibilidad"
          title="Reglas y bloqueos"
          description="Esto sólo prepara disponibilidad; no crea reservas ni agenda turnos en Phase 02."
        >
          <div className="space-y-3">
            {availabilityRules.map((item) => (
              <article
                className="border-ink/10 rounded-xl border bg-white/60 p-4 dark:border-white/10 dark:bg-[#2a231c]"
                key={item.id}
              >
                <p className="font-semibold">
                  Día {item.weekday} · {item.start_time.slice(0, 5)}–
                  {item.end_time.slice(0, 5)}
                </p>
                <p className="text-ink/70 mt-1 text-xs">
                  {item.timezone} · {item.is_active ? "activo" : "inactivo"}
                </p>
                <DeleteForm action={actions.deleteRule} recordId={item.id} />
              </article>
            ))}
          </div>
          <div className="border-ink/10 mt-5 border-t pt-5">
            <ActionForm action={actions.saveRule} submitLabel="Agregar regla">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Día (0 domingo – 6 sábado)"
                  name="weekday"
                  type="number"
                  min={0}
                  max={6}
                  required
                />
                <Field
                  label="Zona horaria"
                  name="timezone"
                  defaultValue="America/Argentina/Buenos_Aires"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Desde"
                  name="startTime"
                  type="time"
                  defaultValue="09:00"
                  required
                />
                <Field
                  label="Hasta"
                  name="endTime"
                  type="time"
                  defaultValue="18:00"
                  required
                />
              </div>
              <Check label="Regla activa" name="isActive" defaultChecked />
            </ActionForm>
          </div>
          <div className="border-ink/10 mt-5 border-t pt-5">
            <p className="font-semibold">Bloqueos</p>
            {availabilityBlocks.map((item) => (
              <article
                className="border-ink/10 mt-3 rounded-xl border bg-white/60 p-4 dark:border-white/10 dark:bg-[#2a231c]"
                key={item.id}
              >
                <p className="text-sm">
                  {new Date(item.starts_at).toLocaleString("es-AR")} →{" "}
                  {new Date(item.ends_at).toLocaleString("es-AR")}
                </p>
                <p className="text-ink/70 mt-1 text-xs">
                  {item.reason ?? "Sin motivo"}
                </p>
                <DeleteForm action={actions.deleteBlock} recordId={item.id} />
              </article>
            ))}
            <ActionForm
              action={actions.saveBlock}
              submitLabel="Agregar bloqueo"
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Comienza"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
                <Field
                  label="Termina"
                  name="endsAt"
                  type="datetime-local"
                  required
                />
              </div>
              <Field label="Motivo" name="reason" />
            </ActionForm>
          </div>
        </Section>
      </div>
    </div>
  );
}
