import Link from "next/link";

export function DiscoveryPagination({
  page,
  hasMore,
  hrefForPage,
}: {
  page: number;
  hasMore: boolean;
  hrefForPage: (page: number) => string;
}) {
  const lastVisible = hasMore ? page + 1 : page;
  const firstVisible = Math.max(1, lastVisible - 4);
  const pages: number[] = [];
  for (
    let candidate = firstVisible;
    candidate <= lastVisible;
    candidate += 1
  ) {
    pages.push(candidate);
  }
  if (pages.length <= 1 && !hasMore) return null;

  return (
    <nav
      aria-label="Paginación de resultados"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link
          className="button-secondary inline-flex min-h-11 items-center px-4"
          href={hrefForPage(page - 1)}
          aria-label={`Ir a la página ${page - 1}`}
        >
          Anterior
        </Link>
      ) : null}
      <ol className="flex flex-wrap items-center justify-center gap-2">
        {pages.map((candidate) => (
          <li key={candidate}>
            <Link
              className="button-secondary inline-grid min-h-11 min-w-11 place-items-center px-3"
              href={hrefForPage(candidate)}
              aria-label={`Ir a la página ${candidate}`}
              aria-current={candidate === page ? "page" : undefined}
            >
              {candidate}
            </Link>
          </li>
        ))}
      </ol>
      {hasMore ? (
        <Link
          className="button-secondary inline-flex min-h-11 items-center px-4"
          href={hrefForPage(page + 1)}
          aria-label={`Ir a la página ${page + 1}`}
        >
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
}
