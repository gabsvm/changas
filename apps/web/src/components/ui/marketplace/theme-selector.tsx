"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "changas-theme";

const OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeChoice(stored)) return stored;
  } catch {
    /* Sin almacenamiento: tema claro. */
  }
  return "light";
}

function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme =
    choice === "system" ? "light dark" : choice;
}

export function ThemeSelector({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    typeof window === "undefined" ? "system" : readStoredChoice(),
  );

  useEffect(() => {
    applyTheme(readStoredChoice());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readStoredChoice() === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const select = (next: ThemeChoice) => {
    setChoice(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Igual se aplica en esta sesión. */
    }
    applyTheme(next);
  };

  return (
    <div
      role="group"
      aria-label="Tema de apariencia"
      className={`bg-surface-muted border-ink/10 mt-3 grid grid-cols-3 gap-1 rounded-2xl border p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = option.value === choice;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => select(option.value)}
            className={
              active
                ? "bg-surface text-ink min-h-11 rounded-xl text-sm font-bold shadow-sm"
                : "text-ink/60 hover:text-ink min-h-11 rounded-xl text-sm font-semibold"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
