import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="border-ink/10 w-full max-w-md rounded-[2rem] border bg-white/75 p-6 shadow-[0_24px_80px_rgba(22,56,50,0.12)] sm:p-8">
      <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
        Acceso
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight font-semibold">
        El enlace no es válido
      </h1>
      <p className="text-ink/65 mt-4 text-sm leading-6">
        El enlace pudo haber expirado o ya fue utilizado. Volvé a iniciar sesión
        para pedir otro.
      </p>
      <Link className="button-primary mt-8 w-full" href="/login">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
