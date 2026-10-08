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
      className="border-ink/[0.07] bg-surface mx-auto mt-8 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border px-3 py-2 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:border-white/10 dark:bg-[#2a231c]"
    >
      {page > 1 ? (
        <Link
          className="consumer-pressable text-ink hover:border-brand-orange/30 inline-flex min-h-11 items-center rounded-full border border-transparent px-4 text-sm font-bold hover:bg-white dark:text-[#f5efe8] dark:hover:bg-white/10"
          href={hrefForPage(page - 1)}
          aria-label={`Ir a la página ${page - 1}`}
        >
          <span aria-hidden="true" className="mr-1">
            ←
          </span>
          Anterior
        </Link>
      ) : null}
      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {pages.map((candidate) =>
          candidate === page ? (
            <li key={candidate}>
              <span
                aria-current="page"
                className="inline-grid min-h-11 min-w-11 place-items-center rounded-full bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_48%,#FF0A78_100%)] px-3 text-sm font-extrabold text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)]"
              >
                {candidate}
              </span>
            </li>
          ) : (
            <li key={candidate}>
              <Link
                className="consumer-pressable text-ink hover:border-brand-orange/30 inline-grid min-h-11 min-w-11 place-items-center rounded-full border border-transparent px-3 text-sm font-bold hover:bg-white dark:text-[#f5efe8] dark:hover:bg-white/10"
                href={hrefForPage(candidate)}
                aria-label={`Ir a la página ${candidate}`}
              >
                {candidate}
              </Link>
            </li>
          ),
        )}
      </ol>
      {hasMore ? (
        <Link
          className="consumer-pressable text-ink hover:border-brand-orange/30 inline-flex min-h-11 items-center rounded-full border border-transparent px-4 text-sm font-bold hover:bg-white dark:text-[#f5efe8] dark:hover:bg-white/10"
          href={hrefForPage(page + 1)}
          aria-label={`Ir a la página ${page + 1}`}
        >
          Siguiente
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
