import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../../app/page.tsx");
const styles = read("../../app/yalo-showcase.css");
const howItWorks = read("../../components/ui/marketplace/how-it-works.tsx");
const serviceCard = read("../../components/ui/marketplace/service-card.tsx");

/** Fragmento del JSX entre dos marcadores (inclusive el primero). */
function between(source: string, from: string, to: string) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Landing — auditoría de placing 2026-11-07", () => {
  it("no repite la pregunta del H1 en el buscador ni en las categorías", () => {
    expect(home).toContain("¿Qué necesitás hacer?");
    expect(home).not.toContain("¿Qué necesitás resolver hoy?");
    expect(home).toContain('placeholder="Ej: plomero, clases de inglés');
    expect(home).not.toContain("¿Qué hacemos hoy");
    expect(home).toContain("Explorá por categoría");
  });

  it("muestra los atajos en una sola fila y sin flechas", () => {
    const shortcuts = between(
      home,
      'className="yalo-hero-shortcuts"',
      "</div>",
    );
    expect(shortcuts).toContain("Presencial");
    expect(shortcuts).toContain("Remoto");
    expect(shortcuts).toContain("Con ofertas");
    expect(shortcuts).not.toContain("ActionArrowIcon");
    expect(shortcuts).not.toContain("Explorá por");
    expect(styles).toMatch(/\.yalo-hero-shortcuts \{\s*flex-wrap: nowrap;/);
  });

  it("ubica la oferta del prestador al pie del hero, después de los atajos", () => {
    const hero = between(home, 'className="yalo-stage"', "</section>");
    const shortcutsAt = hero.indexOf("yalo-hero-shortcuts");
    const searchAt = hero.indexOf("yalo-hero-search");
    const providerAt = hero.indexOf("yalo-hero-offer--provider");
    expect(searchAt).toBeGreaterThan(-1);
    expect(shortcutsAt).toBeGreaterThan(searchAt);
    expect(providerAt).toBeGreaterThan(shortcutsAt);
    expect(hero).toContain('href="/provider/onboarding"');
    expect(styles).toContain(".yalo-hero-offer--provider {");
  });

  it("compacta las garantías a una fila en mobile con labels cortos", () => {
    expect(home).toContain('{ label: "Precio por chat" }');
    expect(home).toContain('{ label: "Reseñas reales" }');
    expect(styles).toMatch(
      /@media \(max-width: 640px\) \{\s*\/\*[^*]*\*\/\s*\.yalo-confidence-bar \{\s*grid-template-columns: repeat\(3,/,
    );
  });

  it("reemplaza el link vago de destacados por un único 'Ver más servicios' al final", () => {
    expect(home).not.toContain("Explorar YALO");
    const featured = between(
      home,
      'aria-labelledby="featured-title"',
      "</section>",
    );
    expect(featured.indexOf("Ver más servicios")).toBeGreaterThan(
      featured.indexOf("<NearbyServiceRail"),
    );
    expect(featured).toContain("yalo-featured-more");
  });

  it("achica el placeholder de cover sólo dentro de destacados", () => {
    expect(serviceCard).toContain("service-card-cover-fallback ");
    expect(serviceCard).toContain("service-card-cover-fallback-label");
    expect(styles).toContain(
      ".yalo-featured-results .service-card-cover-fallback {",
    );
    expect(styles).not.toMatch(/^\.service-card-cover-fallback/m);
  });

  it("dice una sola vez cómo funciona: sin tarjetas de beneficios duplicadas", () => {
    expect(home).not.toContain("yalo-value-card");
    expect(home).not.toContain("const benefits");
    expect(home).toContain("<HowItWorks />");
    expect(styles).not.toContain("yalo-value");
    expect(howItWorks).toContain("identidad verificada");
    expect(howItWorks).toContain("por chat");
    expect(howItWorks).toContain("reseña");
  });
});
