import Link from "next/link";

const sections = [
  [
    "/admin/identity",
    "Identidad",
    "Revisá documentos y decisiones pendientes.",
  ],
  [
    "/admin/reports",
    "Trust & Safety",
    "Atendé reportes, restricciones y moderación.",
  ],
  ["/admin/catalog", "Catálogo", "Gestioná categorías, skills y servicios."],
  [
    "/admin/providers",
    "Prestadores",
    "Buscá perfiles y revisá su estado operativo.",
  ],
  ["/admin/users", "Usuarios", "Inspeccioná cuentas y aplicá restricciones."],
  ["/admin/jobs", "Trabajos", "Consultá el estado y contexto de trabajos."],
  [
    "/admin/audit",
    "Auditoría",
    "Verificá el historial administrativo append-only.",
  ],
] as const;

export default function AdminPage() {
  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">Operación</p>
        <h2 className="text-2xl font-bold">Panel administrativo</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Las rutas son sólo interfaz: cada lectura y mutación sensible vuelve a
          validar permisos en PostgreSQL.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(([href, title, description]) => (
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
            href={href}
            key={href}
          >
            <h3 className="font-bold">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
