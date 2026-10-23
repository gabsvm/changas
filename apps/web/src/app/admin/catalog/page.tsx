import {
  createCategoryAction,
  createServiceTagAction,
  createSkillAction,
  createSkillSynonymAction,
  deleteCategoryAction,
  deleteServiceTagAction,
  deleteSkillAction,
  deleteSkillSynonymAction,
  setServiceModerationAction,
  updateCategoryStateAction,
  updateServiceTagAction,
  updateSkillStateAction,
  updateSkillSynonymAction,
  reviewSkillRequestAction,
} from "@/app/admin/actions";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import {
  listAdminCategories,
  listAdminServices,
  listAdminServiceTags,
  listAdminSkills,
  listAdminSkillSynonyms,
  listSkillRequestQueue,
} from "@/lib/admin/server";

function moderationTone(
  state: string,
): "success" | "pending" | "danger" | "info" {
  if (state === "CLEAR") return "success";
  if (state === "DISABLED") return "danger";
  if (state === "FLAGGED") return "pending";
  return "info";
}

export default async function AdminCatalogPage() {
  const [categories, skills, services, synonyms, tags, skillRequests] =
    await Promise.all([
      listAdminCategories(),
      listAdminSkills(),
      listAdminServices(),
      listAdminSkillSynonyms(),
      listAdminServiceTags(),
      listSkillRequestQueue(),
    ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Catálogo"
        title="Catálogo y servicios"
        description="CRUD administrativo con desactivación reversible como camino normal."
      />
      <nav
        aria-label="Secciones del catálogo"
        className="consumer-scrollbar-none bg-canvas/95 border-ink/[0.06] sticky top-[4.5rem] z-20 -mx-1 flex gap-2 overflow-x-auto px-1 py-2 backdrop-blur-xl"
      >
        {(
          [
            ["crear", "Crear"],
            ["solicitudes", "Solicitudes"],
            ["categorias", "Categorías"],
            ["skills", "Skills"],
            ["sinonimos", "Sinónimos"],
            ["tags", "Tags"],
            ["moderacion", "Moderación"],
          ] as Array<[string, string]>
        ).map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="consumer-pressable border-ink/[0.08] bg-surface text-ink inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-[13px] font-bold"
          >
            {label}
          </a>
        ))}
      </nav>
      <div id="crear" className="grid w-full min-w-0 grid-cols-1 scroll-mt-40 gap-4 lg:grid-cols-2">
        <AdminPanel className="w-full min-w-0">
          <form action={createCategoryAction} className="w-full min-w-0">
            <h3 className="text-ink text-base font-extrabold">
              Nueva categoría
            </h3>
            <div className="mt-3 grid w-full min-w-0 gap-2">
              <label className="grid gap-1 text-xs font-semibold text-ink">Nombre de categoría
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="name"
                required
                placeholder="Nombre"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Slug de categoría
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="slug"
                required
                placeholder="slug"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Descripción de categoría
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="description"
                placeholder="Descripción"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Orden de visualización de categoría
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
              </label>
              <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear categoría
              </button>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel className="w-full min-w-0">
          <form action={createSkillAction} className="w-full min-w-0">
            <h3 className="text-ink text-base font-extrabold">Nueva skill</h3>
            <div className="mt-3 grid w-full min-w-0 gap-2">
              <label className="grid gap-1 text-xs font-semibold text-ink">Categoría de la nueva skill
              <select
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="categoryId"
                required
              >
                {categories.map((category) => (
                  <option
                    value={category.category_id}
                    key={category.category_id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Nombre de la nueva skill
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="name"
                required
                placeholder="Nombre"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Slug de la nueva skill
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="slug"
                required
                placeholder="slug"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Descripción de la nueva skill
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="description"
                placeholder="Descripción"
              />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Orden de visualización de la nueva skill
              <input
                className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
              </label>
              <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear skill
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminPanel className="w-full min-w-0">
          <form action={createSkillSynonymAction} className="w-full min-w-0">
            <h3 className="text-ink text-base font-extrabold">
              Nuevo sinónimo
            </h3>
            <div className="mt-3 grid w-full min-w-0 gap-2">
              <label className="grid min-w-0 gap-1 break-words text-xs font-semibold text-ink">Skill del nuevo sinónimo
              <select
                className="border-ink/10 text-ink w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="skillId"
                required
              >
                {skills.map((skill) => (
                  <option value={skill.skill_id} key={skill.skill_id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              </label>
              <label className="grid min-w-0 gap-1 break-words text-xs font-semibold text-ink">Frase equivalente del nuevo sinónimo
              <input
                className="border-ink/10 text-ink w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="phrase"
                required
                minLength={2}
                maxLength={120}
                placeholder="Frase equivalente"
              />
              </label>
              <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear sinónimo
              </button>
            </div>
          </form>
        </AdminPanel>
        <AdminPanel className="w-full min-w-0">
          <form action={createServiceTagAction} className="w-full min-w-0">
            <h3 className="text-ink text-base font-extrabold">Nuevo tag</h3>
            <div className="mt-3 grid w-full min-w-0 gap-2">
              <label className="grid gap-1 text-xs font-semibold text-ink">Servicio del nuevo tag
              <select
                className="border-ink/10 text-ink w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="serviceId"
                required
              >
                {services.map((service) => (
                  <option value={service.service_id} key={service.service_id}>
                    {service.service_title}
                  </option>
                ))}
              </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-ink">Tag de búsqueda nuevo
              <input
                className="border-ink/10 text-ink w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                name="tag"
                required
                minLength={2}
                maxLength={80}
                placeholder="Tag de búsqueda"
              />
              </label>
              <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear tag
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>

      <div id="solicitudes" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">
          Solicitudes de habilidades
        </h3>
        {skillRequests.length === 0 ? (
          <p className="text-ink/60 text-sm">
            Sin solicitudes. Cuando un prestador proponga algo nuevo aparece
            acá.
          </p>
        ) : (
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {skillRequests.map((request) => (
              <article
                className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-3xl border p-4 sm:p-5"
                key={request.request_id}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-ink font-extrabold">{request.name}</p>
                    <p className="text-ink/60 text-xs">
                      {request.requester_name} · {request.category_name} ·{" "}
                      {request.service_title}
                    </p>
                    {request.description ? (
                      <p className="text-ink/60 mt-1 text-xs">
                        {request.description}
                      </p>
                    ) : null}
                  </div>
                  <AdminStatusBadge
                    label={
                      request.status === "PENDING"
                        ? "Pendiente"
                        : request.status === "APPROVED"
                          ? "Aprobada"
                          : request.status === "MERGED"
                            ? "Fusionada"
                            : "Rechazada"
                    }
                    tone={
                      request.status === "PENDING"
                        ? "pending"
                        : request.status === "APPROVED"
                          ? "success"
                          : request.status === "MERGED"
                            ? "info"
                            : "danger"
                    }
                  />
                </div>
                {request.status === "PENDING" ? (
                  <div className="mt-3 grid gap-2">
                    <form action={reviewSkillRequestAction}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.request_id}
                      />
                      <input
                        type="hidden"
                        name="decision"
                        value="APPROVE_NEW"
                      />
                      <button className="min-h-11 w-full rounded-xl bg-[#12D9C5] px-3 py-2 text-sm font-extrabold text-[#10131a]">
                        Aprobar como nueva
                      </button>
                    </form>
                    <form action={reviewSkillRequestAction}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.request_id}
                      />
                      <input type="hidden" name="decision" value="MERGE" />
                      <label className="grid gap-1 text-xs font-semibold text-ink">
                        Skill existente para fusionar la solicitud de {request.name}
                        <select
                          className="border-ink/10 text-ink w-full min-w-0 rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                          name="matchedSkillId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Fusionar a…
                          </option>
                          {skills.map((skill) => (
                            <option value={skill.skill_id} key={skill.skill_id}>
                              {skill.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="border-ink/[0.08] text-ink mt-2 min-h-11 w-full rounded-xl border px-3 py-2 text-sm font-extrabold">
                        Fusionar a existente
                      </button>
                    </form>
                    <form action={reviewSkillRequestAction}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.request_id}
                      />
                      <input type="hidden" name="decision" value="REJECT" />
                      <label className="grid gap-1 text-xs font-semibold text-ink">
                        Motivo del rechazo de {request.name}
                        <input
                          className="border-ink/10 text-ink w-full min-w-0 rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                          name="reviewerNote"
                          required
                          minLength={2}
                          placeholder="Motivo del rechazo"
                        />
                      </label>
                      <button className="border-danger/25 text-danger mt-2 min-h-11 w-full rounded-xl border px-3 py-2 text-sm font-extrabold">
                        Rechazar
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div id="categorias" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">Categorías</h3>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <article
              className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-3xl border p-4 sm:p-5"
              key={category.category_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-ink font-extrabold">{category.name}</p>
                  <p className="text-ink/60 text-xs">
                    {category.slug} · {category.skill_count} skills
                  </p>
                </div>
                <AdminStatusBadge
                  label={category.is_active ? "Activa" : "Inactiva"}
                  tone={category.is_active ? "success" : "neutral"}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={updateCategoryStateAction}>
                  <input
                    type="hidden"
                    name="categoryId"
                    value={category.category_id}
                  />
                  <input type="hidden" name="slug" value={category.slug} />
                  <input type="hidden" name="name" value={category.name} />
                  <input
                    type="hidden"
                    name="description"
                    value={category.description ?? ""}
                  />
                  <input
                    type="hidden"
                    name="sortOrder"
                    value={category.sort_order}
                  />
                  <input
                    type="hidden"
                    name="nextActive"
                    value={String(!category.is_active)}
                  />
                  <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                    {category.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </form>

                {category.skill_count === 0 ? (
                  <details>
                    <summary className="bg-danger inline-block cursor-pointer rounded-xl px-3 py-2 text-sm font-extrabold text-white">
                      Eliminar
                    </summary>
                    <form action={deleteCategoryAction} className="mt-2">
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.category_id}
                      />
                      <button className="border-danger/25 text-danger rounded-xl border px-3 py-2 text-sm font-extrabold">
                        Confirmar eliminación
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>

              <details className="border-ink/[0.08] bg-surface mt-3 rounded-2xl border p-3">
                <summary className="text-ink cursor-pointer text-sm font-extrabold">
                  Editar categoría
                </summary>
                <form
                  action={updateCategoryStateAction}
                  className="mt-2 grid gap-2"
                >
                  <input
                    type="hidden"
                    name="categoryId"
                    value={category.category_id}
                  />
                  <input
                    type="hidden"
                    name="nextActive"
                    value={String(category.is_active)}
                  />
                  <label className="grid gap-1 text-xs font-semibold text-ink">Nombre de categoría: {category.name}
                    <input className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white" name="name" required defaultValue={category.name} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">Slug de categoría: {category.name}
                    <input className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white" name="slug" required defaultValue={category.slug} />
                    <span className="font-normal text-ink/60">Identificador corto usado en enlaces.</span>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">Descripción de categoría: {category.name}
                    <input className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white" name="description" defaultValue={category.description ?? ""} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">Orden de visualización de categoría: {category.name}
                    <input className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white" name="sortOrder" type="number" defaultValue={category.sort_order} />
                    <span className="font-normal text-ink/60">Número menor aparece primero.</span>
                  </label>
                  <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div id="skills" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">Skills</h3>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <article
              className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-3xl border p-4 sm:p-5"
              key={skill.skill_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-ink font-extrabold">{skill.name}</p>
                  <p className="text-ink/60 text-xs">
                    {skill.category_name} · {skill.service_count} servicios
                  </p>
                </div>
                <AdminStatusBadge
                  label={skill.is_active ? "Activa" : "Inactiva"}
                  tone={skill.is_active ? "success" : "neutral"}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={updateSkillStateAction}>
                  <input type="hidden" name="skillId" value={skill.skill_id} />
                  <input
                    type="hidden"
                    name="categoryId"
                    value={skill.category_id}
                  />
                  <input type="hidden" name="slug" value={skill.slug} />
                  <input type="hidden" name="name" value={skill.name} />
                  <input
                    type="hidden"
                    name="description"
                    value={skill.description ?? ""}
                  />
                  <input
                    type="hidden"
                    name="sortOrder"
                    value={skill.sort_order}
                  />
                  <input
                    type="hidden"
                    name="nextActive"
                    value={String(!skill.is_active)}
                  />
                  <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                    {skill.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </form>

                {skill.service_count === 0 ? (
                  <details>
                    <summary className="bg-danger inline-block cursor-pointer rounded-xl px-3 py-2 text-sm font-extrabold text-white">
                      Eliminar
                    </summary>
                    <form action={deleteSkillAction} className="mt-2">
                      <input
                        type="hidden"
                        name="skillId"
                        value={skill.skill_id}
                      />
                      <button className="border-danger/25 text-danger rounded-xl border px-3 py-2 text-sm font-extrabold">
                        Confirmar eliminación
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>

              <details className="border-ink/[0.08] bg-surface mt-3 rounded-2xl border p-3">
                <summary className="text-ink cursor-pointer text-sm font-extrabold">
                  Editar skill
                </summary>
                <form
                  action={updateSkillStateAction}
                  className="mt-2 grid gap-2"
                >
                  <input type="hidden" name="skillId" value={skill.skill_id} />
                  <input
                    type="hidden"
                    name="nextActive"
                    value={String(skill.is_active)}
                  />
                  <label className="grid gap-1 text-xs font-semibold text-ink">
                    Categoría de la skill {skill.name}
                    <select
                      className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="categoryId"
                      defaultValue={skill.category_id}
                    >
                      {categories.map((category) => (
                        <option
                          value={category.category_id}
                          key={category.category_id}
                        >
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">
                    Nombre de la skill {skill.name}
                    <input
                      className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="name"
                      required
                      defaultValue={skill.name}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">
                    Slug de la skill {skill.name}
                    <input
                      className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="slug"
                      required
                      defaultValue={skill.slug}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">
                    Descripción de la skill {skill.name}
                    <input
                      className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="description"
                      defaultValue={skill.description ?? ""}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink">
                    Orden de visualización de la skill {skill.name}
                    <input
                      className="border-ink/10 text-ink rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="sortOrder"
                      type="number"
                      defaultValue={skill.sort_order}
                    />
                  </label>
                  <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div id="sinonimos" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">Sinónimos</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {synonyms.map((synonym) => (
            <article
              className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-3xl border p-4 sm:p-5"
              key={synonym.synonym_id}
            >
              <p className="text-ink font-extrabold">{synonym.phrase}</p>
              <p className="text-ink/60 text-xs">
                {synonym.skill_name} · {synonym.normalized_phrase}
              </p>
              <form
                action={updateSkillSynonymAction}
                className="mt-3 grid w-full min-w-0 gap-2"
              >
                <label className="grid gap-1 text-xs font-semibold text-ink">
                  Frase equivalente del sinónimo “{synonym.phrase}”
                  <input
                    className="border-ink/10 text-ink w-full min-w-0 rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="phrase"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={synonym.phrase}
                  />
                </label>
                <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                  Actualizar
                </button>
              </form>
              <details className="mt-2">
                <summary className="bg-danger inline-block cursor-pointer rounded-xl px-3 py-2 text-sm font-extrabold text-white">
                  Eliminar
                </summary>
                <form action={deleteSkillSynonymAction} className="mt-2">
                  <input
                    type="hidden"
                    name="synonymId"
                    value={synonym.synonym_id}
                  />
                  <button className="border-danger/25 text-danger rounded-xl border px-3 py-2 text-sm font-extrabold">
                    Confirmar eliminación
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div id="tags" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">
          Tags de servicios
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {tags.map((tag) => (
            <article
              className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-3xl border p-4 sm:p-5"
              key={`${tag.service_id}:${tag.normalized_tag}`}
            >
              <p className="text-ink font-extrabold">{tag.tag}</p>
              <p className="text-ink/60 text-xs">
                {tag.service_title} · {tag.normalized_tag}
              </p>
              <form action={updateServiceTagAction} className="mt-3 grid w-full min-w-0 gap-2">
                <input type="hidden" name="serviceId" value={tag.service_id} />
                <input
                  type="hidden"
                  name="normalizedTag"
                  value={tag.normalized_tag}
                />
                <label className="grid gap-1 text-xs font-semibold text-ink">
                  Tag de búsqueda de {tag.service_title}
                  <input
                    className="border-ink/10 text-ink w-full min-w-0 rounded-lg border bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="tag"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={tag.tag}
                  />
                </label>
                <button className="border-ink/[0.08] text-ink rounded-xl border px-3 py-2 text-sm font-extrabold">
                  Actualizar
                </button>
              </form>
              <details className="mt-2">
                <summary className="bg-danger inline-block cursor-pointer rounded-xl px-3 py-2 text-sm font-extrabold text-white">
                  Eliminar
                </summary>
                <form action={deleteServiceTagAction} className="mt-2">
                  <input
                    type="hidden"
                    name="serviceId"
                    value={tag.service_id}
                  />
                  <input
                    type="hidden"
                    name="normalizedTag"
                    value={tag.normalized_tag}
                  />
                  <button className="border-danger/25 text-danger rounded-xl border px-3 py-2 text-sm font-extrabold">
                    Confirmar eliminación
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div id="moderacion" className="scroll-mt-40">
        <h3 className="text-ink mb-3 text-base font-extrabold">
          Moderación de servicios
        </h3>
        <div className="space-y-3">
          {services.map((service) => (
            <article
              className="border-ink/[0.08] bg-surface rounded-3xl border p-4 sm:p-5"
              key={service.service_id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-ink font-extrabold">
                    {service.service_title}
                  </p>
                  <p className="text-ink/60 text-xs">
                    {service.provider_display_name ?? service.provider_user_id}{" "}
                    · {service.skill_name}
                  </p>
                </div>
                <AdminStatusBadge
                  label={service.moderation_state}
                  tone={moderationTone(service.moderation_state)}
                />
              </div>
              <div className="mt-3 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                {(["FLAGGED", "DISABLED", "CLEAR"] as const).map((state) => (
                  <form
                    action={setServiceModerationAction}
                    className="border-ink/[0.08] bg-surface w-full min-w-0 rounded-2xl border p-3"
                    key={state}
                  >
                    <input
                      type="hidden"
                      name="serviceId"
                      value={service.service_id}
                    />
                    <input type="hidden" name="state" value={state} />
                    {state === "CLEAR" ? null : (
                      <label className="grid gap-1 text-xs font-semibold text-ink">
                        Motivo para {state === "DISABLED" ? "deshabilitar" : "marcar"} {service.service_title}
                        <input
                          className="border-ink/10 text-ink w-full min-w-0 rounded-md border bg-white px-2 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                          name="reason"
                          required
                          minLength={3}
                          placeholder="Motivo"
                        />
                      </label>
                    )}
                    <button
                      className={
                        state === "DISABLED"
                          ? "bg-danger mt-2 w-full rounded-xl px-2 py-2 text-sm font-extrabold text-white"
                          : "border-ink/[0.08] text-ink mt-2 w-full rounded-xl border px-2 py-2 text-sm font-extrabold"
                      }
                    >
                      {state === "CLEAR"
                        ? "Restaurar"
                        : state === "DISABLED"
                          ? "Deshabilitar"
                          : "Marcar"}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
