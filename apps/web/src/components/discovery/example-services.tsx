import { riseStyle } from "@/lib/ui/motion";
import { EXAMPLE_SERVICES } from "@/lib/discovery/example-services";
import { ServiceCard } from "@/components/ui/marketplace/service-card";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { ActionLink } from "@/components/ui/marketplace/action-button";

export function ExampleServices({ publishHref }: { publishHref: string }) {
  return (
    <section aria-labelledby="example-services-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="example-services-title"
          className="text-base font-extrabold tracking-[-0.02em]"
        >
          Así se verán los servicios
        </h2>
        <StatusChip tone="warning">Ejemplos</StatusChip>
      </div>
      <p className="text-ink/70 mt-1.5 text-sm leading-6">
        Todavía no hay servicios publicados. Estas tarjetas son ejemplos con
        datos ficticios para que veas cómo se mostrarán: no se pueden contratar
        y desaparecen cuando se publique el primer servicio real.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {EXAMPLE_SERVICES.map((row, index) => (
          <li
            key={row.service_slug}
            className="rise-in"
            style={riseStyle(index)}
          >
            <ServiceCard row={row} example />
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <ActionLink href={publishHref} tone="secondary">
          Publicar un servicio
        </ActionLink>
      </div>
    </section>
  );
}
