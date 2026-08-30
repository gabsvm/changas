"use client";

export default function Error({
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-terracotta text-sm font-semibold tracking-[0.18em] uppercase">
          Changas
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold">
          Algo no salió como esperábamos.
        </h1>
        <p className="text-ink/65 mt-4">
          Podés intentar cargar esta vista nuevamente.
        </p>
        <button
          className="button-primary mt-7"
          onClick={() => reset()}
          type="button"
        >
          Intentar de nuevo
        </button>
      </div>
    </main>
  );
}
