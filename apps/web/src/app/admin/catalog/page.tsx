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
} from "@/lib/admin/server";

function moderationTone(state: string): "success" | "pending" | "danger" | "info" {
  if (state === "CLEAR") return "success";
  if (state === "DISABLED") return "danger";
  if (state === "FLAGGED") return "pending";
  return "info";
}

export default async function AdminCatalogPage() {
  const [categories, skills, services, synonyms, tags] = await Promise.all([
    listAdminCategories(),
    listAdminSkills(),
    listAdminServices(),
    listAdminSkillSynonyms(),
    listAdminServiceTags(),
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Catálogo"
        title="Catálogo y servicios"
        description="CRUD administrativo con desactivación reversible como camino normal."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel>
          <form action={createCategoryAction}>
            <h3 className="text-base font-extrabold text-white">
              Nueva categoría
            </h3>
            <div className="mt-3 grid gap-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="name"
                required
                placeholder="Nombre"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="slug"
                required
                placeholder="slug"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="description"
                placeholder="Descripción"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
              <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear categoría
              </button>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel>
          <form action={createSkillAction}>
            <h3 className="text-base font-extrabold text-white">Nueva skill</h3>
            <div className="mt-3 grid gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
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
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="name"
                required
                placeholder="Nombre"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="slug"
                required
                placeholder="slug"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="description"
                placeholder="Descripción"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
              <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear skill
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel>
          <form action={createSkillSynonymAction}>
            <h3 className="text-base font-extrabold text-white">
              Nuevo sinónimo
            </h3>
            <div className="mt-3 grid gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="skillId"
                required
              >
                {skills.map((skill) => (
                  <option value={skill.skill_id} key={skill.skill_id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="phrase"
                required
                minLength={2}
                maxLength={120}
                placeholder="Frase equivalente"
              />
              <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear sinónimo
              </button>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel>
          <form action={createServiceTagAction}>
            <h3 className="text-base font-extrabold text-white">Nuevo tag</h3>
            <div className="mt-3 grid gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="serviceId"
                required
              >
                {services.map((service) => (
                  <option value={service.service_id} key={service.service_id}>
                    {service.service_title}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                name="tag"
                required
                minLength={2}
                maxLength={80}
                placeholder="Tag de búsqueda"
              />
              <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                Crear tag
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-white">Categorías</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <article
              className="rounded-3xl border border-[#273142] bg-[#151c27] p-4 sm:p-5"
              key={category.category_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-extrabold text-white">{category.name}</p>
                  <p className="text-xs text-[#697386]">
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
                  <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                    {category.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </form>

                {category.skill_count === 0 ? (
                  <details>
                    <summary className="inline-block cursor-pointer rounded-xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                      Eliminar
                    </summary>
                    <form action={deleteCategoryAction} className="mt-2">
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.category_id}
                      />
                      <button className="rounded-xl border border-[#ef5350] px-3 py-2 text-sm font-extrabold text-[#ef5350]">
                        Confirmar eliminación
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>

              <details className="mt-3 rounded-2xl border border-[#273142] bg-[#101720] p-3">
                <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
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
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="name"
                    required
                    defaultValue={category.name}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="slug"
                    required
                    defaultValue={category.slug}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="description"
                    defaultValue={category.description ?? ""}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="sortOrder"
                    type="number"
                    defaultValue={category.sort_order}
                  />
                  <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-white">Skills</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <article
              className="rounded-3xl border border-[#273142] bg-[#151c27] p-4 sm:p-5"
              key={skill.skill_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-extrabold text-white">{skill.name}</p>
                  <p className="text-xs text-[#697386]">
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
                  <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                    {skill.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </form>

                {skill.service_count === 0 ? (
                  <details>
                    <summary className="inline-block cursor-pointer rounded-xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                      Eliminar
                    </summary>
                    <form action={deleteSkillAction} className="mt-2">
                      <input
                        type="hidden"
                        name="skillId"
                        value={skill.skill_id}
                      />
                      <button className="rounded-xl border border-[#ef5350] px-3 py-2 text-sm font-extrabold text-[#ef5350]">
                        Confirmar eliminación
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>

              <details className="mt-3 rounded-2xl border border-[#273142] bg-[#101720] p-3">
                <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
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
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2"
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
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="name"
                    required
                    defaultValue={skill.name}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="slug"
                    required
                    defaultValue={skill.slug}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="description"
                    defaultValue={skill.description ?? ""}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    name="sortOrder"
                    type="number"
                    defaultValue={skill.sort_order}
                  />
                  <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-white">Sinónimos</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {synonyms.map((synonym) => (
            <article
              className="rounded-3xl border border-[#273142] bg-[#151c27] p-4 sm:p-5"
              key={synonym.synonym_id}
            >
              <p className="font-extrabold text-white">{synonym.phrase}</p>
              <p className="text-xs text-[#697386]">
                {synonym.skill_name} · {synonym.normalized_phrase}
              </p>
              <form
                action={updateSkillSynonymAction}
                className="mt-3 grid gap-2"
              >
                <input
                  type="hidden"
                  name="synonymId"
                  value={synonym.synonym_id}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  name="phrase"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={synonym.phrase}
                />
                <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                  Actualizar
                </button>
              </form>
              <details className="mt-2">
                <summary className="inline-block cursor-pointer rounded-xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                  Eliminar
                </summary>
                <form action={deleteSkillSynonymAction} className="mt-2">
                  <input
                    type="hidden"
                    name="synonymId"
                    value={synonym.synonym_id}
                  />
                  <button className="rounded-xl border border-[#ef5350] px-3 py-2 text-sm font-extrabold text-[#ef5350]">
                    Confirmar eliminación
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-white">
          Tags de servicios
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {tags.map((tag) => (
            <article
              className="rounded-3xl border border-[#273142] bg-[#151c27] p-4 sm:p-5"
              key={`${tag.service_id}:${tag.normalized_tag}`}
            >
              <p className="font-extrabold text-white">{tag.tag}</p>
              <p className="text-xs text-[#697386]">
                {tag.service_title} · {tag.normalized_tag}
              </p>
              <form action={updateServiceTagAction} className="mt-3 grid gap-2">
                <input type="hidden" name="serviceId" value={tag.service_id} />
                <input
                  type="hidden"
                  name="normalizedTag"
                  value={tag.normalized_tag}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  name="tag"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={tag.tag}
                />
                <button className="rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                  Actualizar
                </button>
              </form>
              <details className="mt-2">
                <summary className="inline-block cursor-pointer rounded-xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                  Eliminar
                </summary>
                <form action={deleteServiceTagAction} className="mt-2">
                  <input type="hidden" name="serviceId" value={tag.service_id} />
                  <input
                    type="hidden"
                    name="normalizedTag"
                    value={tag.normalized_tag}
                  />
                  <button className="rounded-xl border border-[#ef5350] px-3 py-2 text-sm font-extrabold text-[#ef5350]">
                    Confirmar eliminación
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-white">
          Moderación de servicios
        </h3>
        <div className="space-y-3">
          {services.map((service) => (
            <article
              className="rounded-3xl border border-[#273142] bg-[#151c27] p-4 sm:p-5"
              key={service.service_id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-extrabold text-white">
                    {service.service_title}
                  </p>
                  <p className="text-xs text-[#697386]">
                    {service.provider_display_name ?? service.provider_user_id}{" "}
                    · {service.skill_name}
                  </p>
                </div>
                <AdminStatusBadge
                  label={service.moderation_state}
                  tone={moderationTone(service.moderation_state)}
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["FLAGGED", "DISABLED", "CLEAR"] as const).map((state) => (
                  <form
                    action={setServiceModerationAction}
                    className="rounded-2xl border border-[#273142] bg-[#101720] p-3"
                    key={state}
                  >
                    <input
                      type="hidden"
                      name="serviceId"
                      value={service.service_id}
                    />
                    <input type="hidden" name="state" value={state} />
                    {state === "CLEAR" ? null : (
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        name="reason"
                        required
                        minLength={3}
                        placeholder="Motivo"
                      />
                    )}
                    <button
                      className={
                        state === "DISABLED"
                          ? "mt-2 w-full rounded-xl bg-[#ef5350] px-2 py-2 text-sm font-extrabold text-white"
                          : "mt-2 w-full rounded-xl border border-[#3a4659] px-2 py-2 text-sm font-extrabold text-[#d0d5dd]"
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
