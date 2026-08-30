import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { createClient } from "@/lib/supabase/server";

import { startProviderOnboarding } from "../../(provider)/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "tu cuenta";

  return (
    <section className="py-10 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Mi cuenta
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            Hola, {displayName}
          </h1>
          <p className="text-ink/65 mt-4 max-w-xl text-sm leading-6">
            Gestioná tu perfil y, si querés, empezá a preparar tu identidad como
            proveedor.
          </p>
        </div>
        <Link className="button-secondary" href="/account/settings">
          Editar configuración
        </Link>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <article className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
          <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
            Presentación
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">
            Lo que otros podrán ver
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-ink/50">Nombre</dt>
              <dd className="mt-1 font-semibold">
                {profile?.display_name || "Sin completar"}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Zona aproximada</dt>
              <dd className="mt-1 font-semibold">
                {profile?.public_zone || "Sin completar"}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Bio</dt>
              <dd className="text-ink/70 mt-1 leading-6">
                {profile?.bio || "Todavía no agregaste una bio."}
              </dd>
            </div>
          </dl>
        </article>

        <article className="border-ink/10 bg-moss rounded-2xl border p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-white/65 uppercase">
            Proveedor
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">
            Prepará tu identidad
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Guardá tu progreso y subí documentos privados para una revisión
            manual posterior.
          </p>
          {provider ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
                {provider.status}
              </span>
              <Link
                className="button-secondary border-white/25 bg-white/10 text-white hover:bg-white/20"
                href="/provider/onboarding"
              >
                Continuar · paso {provider.onboarding_step}/4
              </Link>
            </div>
          ) : (
            <StartProviderForm action={startProviderOnboarding} />
          )}
        </article>
      </div>
    </section>
  );
}
