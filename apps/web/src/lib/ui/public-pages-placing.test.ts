import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const search = read("../../app/buscar/page.tsx");
const category = read("../../app/categoria/[slug]/page.tsx");
const results = read("../../components/discovery/discovery-results.tsx");
const interior = read("../../app/yalo-interior.css");
const globals = read("../../app/globals.css");
const guided = read("../../components/ui/guided.tsx");
const profile = read("../../app/p/[slug]/page.tsx");
const service = read("../../app/p/[slug]/[serviceSlug]/page.tsx");

describe("Páginas públicas — auditoría de placing 2026-11-07", () => {
  describe("/buscar", () => {
    it("usa un solo título visible en mobile", () => {
      expect(search).toContain('"Explorar servicios"}');
      expect(search).toMatch(/<h1 className="[^"]*max-sm:sr-only/);
    });

    it("pone zona, Filtros y Buscar en una sola fila", () => {
      const row = search.slice(
        search.indexOf("Zona, Filtros y Buscar"),
        search.indexOf("</form>"),
      );
      expect(row.indexOf("<LocationPicker")).toBeGreaterThan(-1);
      expect(row.indexOf("<SearchFiltersSheet")).toBeGreaterThan(
        row.indexOf("<LocationPicker"),
      );
      expect(row.indexOf('type="submit"')).toBeGreaterThan(
        row.indexOf("<SearchFiltersSheet"),
      );
    });

    it("muestra las categorías en una fila deslizable y sin texto de ayuda", () => {
      expect(search).toMatch(
        /yalo-category-filters[^"]*overflow-x-auto[^"]*sm:flex-wrap/,
      );
      expect(search).not.toContain("Usá los filtros para afinar");
    });

    it("usa el conteo como encabezado de resultados", () => {
      expect(results).not.toContain('title="Resultados"');
      expect(results).toContain('"Cerca mío"');
    });
  });

  describe("/categoria/[slug]", () => {
    it("no repite la categoría como chip removible", () => {
      expect(category).not.toContain("Quitar filtro de categoría");
    });

    it("centra el CTA de búsqueda con el botón oscuro común", () => {
      expect(category).toMatch(/cta-ink[^"]*justify-center/);
      const override = interior.slice(
        interior.lastIndexOf(".yalo-ui .yalo-category-hero .cta-ink {"),
      );
      expect(override).toContain("background: #0b1220;");
    });

    it("ofrece una salida útil cuando la categoría no tiene servicios", () => {
      expect(category).toContain(
        "Todavía no hay servicios de ${category.name}",
      );
      expect(category).toContain("suggestions: otherCategories.map");
      expect(results).toContain('"Ver todos los servicios"');
      expect(results).toContain('aria-label="Otras categorías"');
      // Sin el bloque decorativo de color sobre el estado vacío.
      expect(results).not.toContain('label="Sin resultados"');
    });
  });

  describe("/p/[prestador]", () => {
    it("muestra el progreso en una línea debajo de la identidad", () => {
      expect(guided).toContain('variant === "inline"');
      expect(profile.indexOf('variant="inline"')).toBeGreaterThan(
        profile.indexOf("{provider.display_name}"),
      );
      expect(profile).not.toMatch(/<GuideHeader[^>]*className="mt-5" \/>/);
    });

    it("pinta los segmentos completados con el gradiente (no como color)", () => {
      expect(guided).not.toContain("bg-[var(--yalo-symbol-gradient)]");
      expect(guided).toContain("[background:var(--yalo-symbol-gradient)]");
    });

    it("superpone el avatar completo y quita el ícono decorativo del banner", () => {
      expect(profile).toContain("relative z-10 -mt-12");
      expect(profile).not.toContain('label="Proveedor verificado de YALO"');
    });

    it("pega la barra de CTA al borde inferior", () => {
      expect(profile).toContain("service-cta-bar service-cta-bar-flush");
      expect(globals).toMatch(/\.service-cta-bar-flush \{\s*bottom: 0;/);
    });

    it("deja una sola garantía y oculta contadores y habilidades duplicadas", () => {
      expect(profile).toContain("Identidad verificada · sin pago por");
      expect(profile).not.toContain("Información pública clara");
      expect(profile).not.toContain("ProfileFact");
      expect(profile).toContain("extraSkills.length ?");
    });
  });

  describe("/p/[prestador]/[servicio]", () => {
    it("lleva el progreso dentro del hero y quita el placeholder alto", () => {
      const hero = service.slice(
        service.indexOf("service-hire-top"),
        service.indexOf("</section>", service.indexOf("service-hire-top")),
      );
      expect(hero).toContain('variant="inline"');
      expect(service).not.toContain("min-h-44");
    });

    it("muestra el precio una sola vez y la garantía dentro del panel", () => {
      expect(service).toContain('"Precio total"');
      expect(service).not.toContain("Subtotal del servicio");
      expect(service).not.toContain("Total a pagar");
      expect(service).not.toContain("Sin pago por adelantado + soporte");
    });

    it("sólo muestra 'Detalles del servicio' si hay contenido", () => {
      expect(service).toContain(
        "service.includes || service.excludes || service.materials_notes",
      );
    });
  });
});
