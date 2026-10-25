import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import {
  ActionButton,
  ActionLink,
} from "@/components/ui/marketplace/action-button";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { createClient } from "@/lib/supabase/server";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { NeedsComingSoon } from "@/components/jobs/needs-coming-soon";
import { listMyJobPosts } from "@/lib/jobs/job-posts-server";
import { governNeedAction } from "./actions";

export const metadata = {
  title: "Mis necesidades | YALO",
  description: "Seguí tus necesidades publicadas y las ofertas recibidas.",
};

const STATUS_LABELS = {
  OPEN: "Abierta",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  HIRED: "Contratada",
} as const;

export default async function NeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0),
  );
  if (!arePublicNeedsEnabled()) return <NeedsComingSoon />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/needs");

  const posts = await listMyJobPosts(page, 20);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Mis necesidades" backHref="/jobs" />
      <h1 className="mt-5 hidden text-[24px] leading-8 font-extrabold tracking-[-0.03em] sm:block">
        Mis necesidades
      </h1>
      <nav className="mt-5 flex gap-3" aria-label="Páginas de mis necesidades">
        {page > 0 ? (
          <ActionLink href={`/needs?page=${page - 1}`} tone="secondary">
            Anterior
          </ActionLink>
        ) : null}
        {posts.length === 20 ? (
          <ActionLink href={`/needs?page=${page + 1}`} tone="secondary">
            Siguiente
          </ActionLink>
        ) : null}
      </nav>
      <div className="mt-4">
        <ActionLink href="/needs/new" className="w-full">
          Publicar necesidad
        </ActionLink>
      </div>
      {posts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Todavía no publicaste necesidades"
            description="Contanos qué necesitás y empezá a comparar ofertas de prestadores."
            actionHref="/needs/new"
            actionLabel="Publicar necesidad"
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="consumer-card bg-surface rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{post.title}</p>
                  <p className="text-ink/70 mt-1 text-[13px]">
                    {post.skill_name ?? "Rubro"} · {STATUS_LABELS[post.status]}
                  </p>
                </div>
                <ActionLink
                  href={`/needs/${post.id}`}
                  tone="secondary"
                  className="min-h-0 px-3 py-2 text-sm"
                >
                  Ver
                </ActionLink>
              </div>
              {(post.status === "OPEN" || post.status === "PAUSED") && (
                <div className="mt-3 flex gap-2">
                  {post.status === "OPEN" ? (
                    <form action={governNeedAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="status" value="PAUSED" />
                      <ActionButton
                        type="submit"
                        tone="secondary"
                        className="min-h-0 px-3 py-2 text-sm"
                      >
                        Pausar
                      </ActionButton>
                    </form>
                  ) : (
                    <form action={governNeedAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="status" value="OPEN" />
                      <ActionButton
                        type="submit"
                        tone="secondary"
                        className="min-h-0 px-3 py-2 text-sm"
                      >
                        Reanudar
                      </ActionButton>
                    </form>
                  )}
                  <form action={governNeedAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="status" value="CLOSED" />
                    <ActionButton
                      type="submit"
                      tone="ghost"
                      className="min-h-0 px-3 py-2 text-sm"
                    >
                      Cerrar
                    </ActionButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
