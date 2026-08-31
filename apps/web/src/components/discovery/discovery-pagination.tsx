import Link from "next/link";

export function DiscoveryPagination({
  previousHref,
  nextHref,
}: {
  previousHref: string | null;
  nextHref: string | null;
}) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav
      aria-label="Paginación de resultados"
      className="mt-8 flex items-center justify-between gap-4"
    >
      {previousHref ? (
        <Link className="button-secondary" href={previousHref}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      {nextHref ? (
        <Link className="button-secondary" href={nextHref}>
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
}
