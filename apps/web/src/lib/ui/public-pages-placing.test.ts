import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const search = read("../../app/buscar/page.tsx");
const category = read("../../app/categoria/[slug]/page.tsx");
const results = read("../../components/discovery/discovery-results.tsx");
const interior = read("../../app/yalo-interior.css");

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
});
