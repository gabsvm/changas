import {
  createCategoryAction,
  createSkillAction,
  setServiceModerationAction,
  updateCategoryStateAction,
  updateSkillStateAction,
} from "@/app/admin/actions";
import {
  listAdminCategories,
  listAdminServices,
  listAdminSkills,
} from "@/lib/admin/server";

export default async function AdminCatalogPage() {
  const [categories, skills, services] = await Promise.all([
    listAdminCategories(),
    listAdminSkills(),
    listAdminServices(),
  ]);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Catálogo y servicios</h2>
        <p className="text-sm text-slate-600">
          CRUD administrativo con desactivación reversible como camino normal.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          action={createCategoryAction}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h3 className="font-bold">Nueva categoría</h3>
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
            <button className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white">
              Crear categoría
            </button>
          </div>
        </form>
        <form
          action={createSkillAction}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h3 className="font-bold">Nueva skill</h3>
          <div className="mt-3 grid gap-2">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              name="categoryId"
              required
            >
              {categories.map((category) => (
                <option value={category.category_id} key={category.category_id}>
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
            <button className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white">
              Crear skill
            </button>
          </div>
        </form>
      </div>
      <div>
        <h3 className="mb-3 text-lg font-bold">Categorías</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={category.category_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-slate-500">
                    {category.slug} · {category.skill_count} skills
                  </p>
                </div>
                <span className="text-xs font-bold">
                  {category.is_active ? "ACTIVA" : "INACTIVA"}
                </span>
              </div>
              <form action={updateCategoryStateAction} className="mt-3">
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
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                  {category.is_active ? "Desactivar" : "Reactivar"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-lg font-bold">Skills</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {skills.map((skill) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={skill.skill_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{skill.name}</p>
                  <p className="text-xs text-slate-500">
                    {skill.category_name} · {skill.service_count} servicios
                  </p>
                </div>
                <span className="text-xs font-bold">
                  {skill.is_active ? "ACTIVA" : "INACTIVA"}
                </span>
              </div>
              <form action={updateSkillStateAction} className="mt-3">
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
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                  {skill.is_active ? "Desactivar" : "Reactivar"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-lg font-bold">Moderación de servicios</h3>
        <div className="space-y-3">
          {services.map((service) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={service.service_id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{service.service_title}</p>
                  <p className="text-xs text-slate-500">
                    {service.provider_display_name ?? service.provider_user_id}{" "}
                    · {service.skill_name}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                  {service.moderation_state}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["FLAGGED", "DISABLED", "CLEAR"] as const).map((state) => (
                  <form
                    action={setServiceModerationAction}
                    className="rounded-lg border border-slate-200 p-2"
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
                    <button className="mt-2 w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold">
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
