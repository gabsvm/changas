import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import {
  IdentityDocumentForm,
  OnboardingForm,
} from "@/components/provider/onboarding-form";
import { createClient } from "@/lib/supabase/server";

import {
  saveProviderOnboarding,
  startProviderOnboarding,
  uploadIdentityDocument,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProviderOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding");
  }

  const [{ data: provider }, { data: documents }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("provider_documents")
      .select("document_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const receivedDocuments = documents ?? [];

  if (!provider) {
    return (
      <section className="py-10 sm:py-14">
        <Link
          className="text-ink/60 text-sm underline underline-offset-4"
          href="/account"
        >
          ← Volver a mi cuenta
        </Link>
        <div className="border-ink/10 mt-10 max-w-2xl rounded-2xl border bg-white/65 p-6 sm:p-8">
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Proveedor
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            Empezá tu onboarding
          </h1>
          <p className="text-ink/65 mt-4 text-sm leading-6">
            Primero creamos un espacio privado para guardar tu progreso. Todavía
            no se publica un servicio ni se activa tu cuenta de proveedor.
          </p>
          <StartProviderForm action={startProviderOnboarding} />
        </div>
      </section>
    );
  }

  const editable =
    provider.status === "PROFILE_INCOMPLETE" ||
    provider.status === "IDENTITY_PENDING";

  return (
    <section className="py-10 sm:py-14">
      <Link
        className="text-ink/60 text-sm underline underline-offset-4"
        href="/account"
      >
        ← Volver a mi cuenta
      </Link>
      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Proveedor
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            Tu identidad, paso a paso
          </h1>
        </div>
        <div className="bg-moss/10 text-moss rounded-full px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
          {provider.status}
        </div>
      </div>
      <p className="text-ink/65 mt-5 max-w-2xl text-sm leading-6">
        El estado es informativo y la aprobación se hará manualmente en una
        etapa posterior. No podés convertirlo en ACTIVE desde tu cuenta.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <OnboardingForm
          action={saveProviderOnboarding}
          currentStep={provider.onboarding_step}
          editable={editable}
        />
        <IdentityDocumentForm
          action={uploadIdentityDocument}
          editable={editable}
        />
      </div>

      <section className="border-ink/10 mt-5 rounded-2xl border bg-white/50 p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">
          Documentos recibidos
        </h2>
        <p className="text-ink/60 mt-2 text-sm leading-6">
          Solo mostramos el tipo y la fecha. La ruta y el contenido permanecen
          privados.
        </p>
        {receivedDocuments.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {receivedDocuments.map((document) => (
              <li
                className="border-ink/10 rounded-xl border bg-white/70 px-4 py-3 text-sm"
                key={`${document.document_type}-${document.created_at}`}
              >
                <span className="block font-semibold">
                  {document.document_type}
                </span>
                <span className="text-ink/55 mt-1 block text-xs">
                  Recibido{" "}
                  {new Date(document.created_at).toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink/55 mt-5 text-sm">
            Todavía no subiste documentos.
          </p>
        )}
      </section>
    </section>
  );
}
