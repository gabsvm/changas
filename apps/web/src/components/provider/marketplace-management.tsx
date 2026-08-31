"use client";

import { useActionState } from "react";

import { formatServicePrice, minorUnitsToMajorInput } from "@changas/domain";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import type { Database } from "@/lib/supabase/database.types";

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
  className = "space-y-4",
}: {
  action: ProviderAction;
  children: React.ReactNode;
  submitLabel: string;
  encType?: "multipart/form-data";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} encType={encType} className={className}>
      {children}
      <button
        className="button-primary disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Guardando…" : submitLabel}
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
          className="bg-moss/10 text-moss rounded-xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {state.success}
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
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null | undefined;
  type?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <textarea
        className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 min-h-24 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
      />
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

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-7">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        {eyebrow}
      </p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="text-ink/60 mt-2 max-w-3xl text-sm leading-6">
        {description}
      </p>
      <div className="mt-6">{children}</div>
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
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
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
          label="Título público"
          name="title"
          defaultValue={service?.title}
          required
        />
      </div>
      <TextArea
        label="Descripción (mínimo 20 caracteres)"
        name="description"
        defaultValue={service?.description}
        required
      />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Modalidad
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
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
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
            name="priceModel"
            defaultValue={service?.price_model ?? "FIXED"}
          >
            <option value="FIXED">Precio fijo</option>
            <option value="STARTING_AT">Desde</option>
            <option value="HOURLY">Por hora</option>
            <option value="PER_UNIT">Por unidad</option>
            <option value="QUOTE">A cotizar</option>
          </select>
        </label>
        <Field
          label="Monto"
          name="priceAmount"
          type="number"
          min={1}
          step="0.01"
          defaultValue={
            service ? minorUnitsToMajorInput(service.price_amount) : ""
          }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Moneda
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
            name="currencyCode"
            defaultValue="ARS"
          >
            <option value="ARS">ARS · Peso argentino</option>
          </select>
        </label>
        <Field
          label="Unidad (sólo por unidad)"
          name="priceUnit"
          defaultValue={service?.price_unit}
        />
        <Field
          label="Duración en minutos"
          name="expectedDurationMinutes"
          type="number"
          min={1}
          defaultValue={service?.expected_duration_minutes}
        />
      </div>
      <Field
        label="Tags (separados por comas, hasta 8)"
        name="tags"
        defaultValue={serviceTags.join(", ")}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Agenda
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
            name="scheduleType"
            defaultValue={service?.schedule_type ?? "UNSCHEDULED"}
          >
            <option value="FIXED_SLOT">Horario fijo</option>
            <option value="FLEXIBLE_WINDOW">Ventana flexible</option>
            <option value="DEADLINE">Con fecha límite</option>
            <option value="UNSCHEDULED">Sin agenda todavía</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-4 pb-2">
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
      </div>
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
          className="border-ink/10 rounded-xl border bg-white/60 p-4"
          key={record.id}
        >
          {render(record)}
          <DeleteForm action={deleteAction} recordId={record.id} />
        </article>
      ))}
    </div>
  ) : (
    <p className="text-ink/55 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
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
  actions,
}: {
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
  return (
    <div className="space-y-6">
      <Section
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
              label="Slug público"
              name="publicSlug"
              defaultValue={provider.public_slug}
              required
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
          <p className="text-ink/55 text-xs">
            Estado de identidad: <strong>{provider.status}</strong>. Sólo un
            flujo server-side/admin controlado puede llevar un proveedor a
            ACTIVE.
          </p>
        </ActionForm>
      </Section>

      <Section
        eyebrow="Catálogo controlado"
        title="Habilidades que ofrecés"
        description="Una habilidad es una capacidad del catálogo; un servicio es una oferta concreta. Podés combinar habilidades no relacionadas sin convertirlas en servicios automáticamente."
      >
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <ActionForm
            action={actions.saveSkill}
            submitLabel="Agregar habilidad"
          >
            <label className="text-sm font-semibold">
              Habilidad
              <select
                className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
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
            <Field
              label="Orden"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={10}
            />
            <Check label="Destacar en mi perfil" name="isFeatured" />
          </ActionForm>
          <div className="space-y-3">
            {providerSkills.length ? (
              providerSkills.map((item) => (
                <div
                  className="border-ink/10 flex items-center justify-between gap-3 rounded-xl border bg-white/60 px-4 py-3"
                  key={item.skill_id}
                >
                  <div>
                    <p className="font-semibold">
                      {skillName.get(item.skill_id) ?? "Habilidad"}
                    </p>
                    <p className="text-ink/55 text-xs">
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
              <p className="text-ink/55 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
                Todavía no agregaste habilidades.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Servicios"
        title="Ofertas concretas"
        description="Definí precio fijo, desde, por hora, por unidad o a cotizar; modalidad presencial/remota/ambas; propuestas y pausa. Publicar queda bloqueado hasta que el proveedor esté ACTIVE."
      >
        <div className="space-y-5">
          {skills.length ? (
            <ServiceForm
              action={actions.saveService}
              skills={skills}
              serviceTags={[]}
            />
          ) : (
            <p className="text-ink/55 border-ink/15 rounded-xl border border-dashed px-4 py-5 text-sm">
              Primero agregá al menos una habilidad para poder crear un
              servicio.
            </p>
          )}
          {services.map((service) => (
            <div
              className="border-ink/10 rounded-xl border bg-white/45 p-4"
              key={service.id}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{service.title}</p>
                  <p className="text-ink/55 text-xs">
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
              </div>
              <ServiceForm
                action={actions.saveService}
                service={service}
                skills={skills}
                serviceTags={serviceTagsByServiceId[service.id] ?? []}
              />
              <div className="mt-3 flex flex-wrap gap-3">
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
                <DeleteForm
                  action={actions.deleteService}
                  recordId={service.id}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
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
                  <p className="text-ink/55 mt-1 text-sm">
                    {item.organization ?? "Sin organización"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                  <p className="text-ink/65 mt-2 text-sm">{item.description}</p>
                </>
              );
            }}
          />
          <div className="border-ink/10 mt-5 border-t pt-5">
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
        </Section>
        <Section
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
                  <p className="text-ink/55 mt-1 text-sm">
                    {item.field_of_study ?? "Campo no especificado"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                </>
              );
            }}
          />
          <div className="border-ink/10 mt-5 border-t pt-5">
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
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          eyebrow="Certificaciones"
          title="Credenciales"
          description="La ficha pública puede mostrar el título y emisor; la evidencia binaria siempre queda en un bucket privado y separado."
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
                  <p className="text-ink/55 mt-1 text-sm">
                    {item.issuer ?? "Emisor no especificado"} ·{" "}
                    {item.is_public ? "pública" : "privada"}
                  </p>
                  <p className="text-ink/65 mt-2 text-xs">
                    {item.evidence_path
                      ? "Evidencia privada guardada"
                      : "Sin evidencia adjunta"}
                  </p>
                </>
              );
            }}
          />
          <div className="border-ink/10 mt-5 border-t pt-5">
            <ActionForm
              action={actions.saveCertification}
              submitLabel="Guardar certificación"
              encType="multipart/form-data"
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
                  className="border-ink/20 mt-2 block w-full rounded-xl border border-dashed bg-white/70 px-3 py-3 text-sm"
                  name="evidence"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                />
              </label>
              <Check label="Mostrar ficha públicamente" name="isPublic" />
            </ActionForm>
          </div>
        </Section>
        <Section
          eyebrow="Portfolio"
          title="Trabajo visible"
          description="Las piezas de portfolio pueden ser públicas sólo cuando vos las marcás así. La media vive en un bucket distinto del de identidad."
        >
          <ProfessionalRecordList
            records={portfolioItems}
            deleteAction={actions.deletePortfolio}
            empty="No hay piezas de portfolio cargadas."
            render={(record) => {
              const item = record as PortfolioItem;
              return (
                <>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-ink/55 mt-1 text-sm">
                    {item.is_public ? "público" : "privado"}
                    {item.media_path
                      ? " · imagen guardada"
                      : " · ficha de texto"}
                  </p>
                  <p className="text-ink/65 mt-2 text-sm">{item.description}</p>
                </>
              );
            }}
          />
          <div className="border-ink/10 mt-5 border-t pt-5">
            <ActionForm
              action={actions.savePortfolio}
              submitLabel="Guardar pieza"
              encType="multipart/form-data"
            >
              <Field label="Título" name="title" required />
              <TextArea label="Descripción" name="description" />
              <label className="text-sm font-semibold">
                Imagen pública opcional
                <input
                  className="border-ink/20 mt-2 block w-full rounded-xl border border-dashed bg-white/70 px-3 py-3 text-sm"
                  name="media"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <Check label="Publicar esta pieza" name="isPublic" />
            </ActionForm>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
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
                  <p className="text-ink/55 mt-1 text-sm">
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
          eyebrow="Disponibilidad"
          title="Reglas y bloqueos"
          description="Esto sólo prepara disponibilidad; no crea reservas ni agenda turnos en Phase 02."
        >
          <div className="space-y-3">
            {availabilityRules.map((item) => (
              <article
                className="border-ink/10 rounded-xl border bg-white/60 p-4"
                key={item.id}
              >
                <p className="font-semibold">
                  Día {item.weekday} · {item.start_time.slice(0, 5)}–
                  {item.end_time.slice(0, 5)}
                </p>
                <p className="text-ink/55 mt-1 text-xs">
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
                className="border-ink/10 mt-3 rounded-xl border bg-white/60 p-4"
                key={item.id}
              >
                <p className="text-sm">
                  {new Date(item.starts_at).toLocaleString("es-AR")} →{" "}
                  {new Date(item.ends_at).toLocaleString("es-AR")}
                </p>
                <p className="text-ink/55 mt-1 text-xs">
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
