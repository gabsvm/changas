import { redirect } from "next/navigation";

import { formatMinorUnits } from "@changas/domain";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ActionLink } from "@/components/ui/marketplace/action-button";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { createClient } from "@/lib/supabase/server";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { NeedsComingSoon } from "@/components/jobs/needs-coming-soon";
import { listOpenJobPosts } from "@/lib/jobs/job-posts-server";

export const metadata = {
  title: "Oportunidades | YALO",
  description:
    "Necesidades abiertas de clientes en tus rubros para ofertar tu trabajo.",
};

export default async function OpportunitiesPage({
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

  if (!user) redirect("/login?next=/oportunidades");

  const { data: mySkills } = await supabase
    .from("provider_skills")
    .select("skill_id")
    .eq("provider_user_id", user.id);
  const skillIds = (mySkills ?? []).map((row) => row.skill_id);

  const allPosts = skillIds.length
    ? await listOpenJobPosts({ skillIds, limit: 30, page })
    : [];
  const posts = allPosts.filter((post) => post.owner_user_id !== user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
      <MobileAppBar title="Oportunidades" backHref="/provider/manage" />
      <nav className="mt-5 flex gap-3" aria-label="Páginas de oportunidades">
        {page > 0 ? (
          <ActionLink href={`/oportunidades?page=${page - 1}`} tone="secondary">
            Anterior
          </ActionLink>
        ) : null}
        {allPosts.length === 30 ? (
          <ActionLink href={`/oportunidades?page=${page + 1}`} tone="secondary">
            Siguiente
          </ActionLink>
        ) : null}
      </nav>
      <p className="text-ink/70 mt-2 text-[15px] leading-6">
        Necesidades abiertas en tus rubros. Ofertá con uno de tus servicios y
        negociá por chat; el pago se acuerda por fuera de YALO.
      </p>
      {posts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={
              allPosts.length === 30
                ? "Todavía hay más oportunidades por revisar"
                : "No hay oportunidades en tus rubros"
            }
            description={
              allPosts.length === 30
                ? "En este grupo no encontramos propuestas ajenas. Podés seguir revisando las siguientes."
                : "Agregá más rubros a tu perfil o volvé más tarde: las necesidades nuevas aparecen acá."
            }
            actionHref={
              allPosts.length === 30
                ? "/oportunidades?page=" + (page + 1)
                : "/provider/manage"
            }
            actionLabel={
              allPosts.length === 30 ? "Ver siguientes" : "Gestionar mis rubros"
            }
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="consumer-card bg-surface rounded-2xl border p-4"
            >
              <p className="text-ink/70 text-[13px] font-bold">
                {post.skill_name ?? "Rubro"}
                {post.location_text ? ` · ${post.location_text}` : ""}
              </p>
              <p className="mt-1 text-sm font-bold">{post.title}</p>
              <p className="text-ink/70 mt-1 line-clamp-2 text-[13px] leading-5">
                {post.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold">
                  {post.desired_budget_amount
                    ? `Ref: ${formatMinorUnits(post.desired_budget_amount, post.currency_code)}`
                    : "Presupuesto a convenir"}
                </span>
                <ActionLink
                  href={`/needs/${post.id}`}
                  tone="secondary"
                  className="min-h-0 px-3 py-2 text-sm"
                >
                  Ver y ofertar
                </ActionLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
