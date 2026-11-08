import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Secciones con sesión — auditoría de placing 2026-11-07", () => {
  describe("/account", () => {
    const account = read("../../app/(account)/account/page.tsx");

    it("muestra primero el trabajo en curso", () => {
      expect(account).toContain("listMyUpcomingJobs(5)");
      expect(account.indexOf("account-active-job")).toBeLessThan(
        account.indexOf("getProviderNextAction({"),
      );
    });

    it("no empuja el alta de prestador a quien no la empezó", () => {
      expect(account).toContain("if (!provider) return null;");
      expect(account).not.toContain("¿Querés ofrecer servicios?");
      expect(account).not.toContain("StartProviderForm");
      expect(account).toContain('title="Ofrecer mis servicios"');
    });

    it("da una acción visible para completar el perfil", () => {
      expect(account).toContain("Completar perfil");
    });
  });
  describe("/messages/[id]", () => {
    const thread = read(
      "../../components/conversations/conversation-thread.tsx",
    );
    const page = read("../../app/(account)/messages/[conversationId]/page.tsx");
    const composer = read(
      "../../components/conversations/proposal-composer.tsx",
    );

    it("no ofrece contratar/cotizar cuando ya hay un trabajo", () => {
      expect(thread).toContain("{spotlight ? null : (");
      expect(thread).toMatch(/currentUserIsClient &&\s*!spotlight &&/);
    });

    it("deja un solo 'Ver seguimiento' y pasa 'Ayuda' al menú", () => {
      expect(page).not.toContain("Este chat tiene un servicio asociado.");
      expect(page).toContain("Trabajo ${spotlightStatus.label.toLowerCase()}");
      expect(thread).toContain("Ayuda con este servicio");
      expect(thread).not.toMatch(/>\s*Ayuda\s*</);
    });

    it("pliega las propuestas cuando hay trabajo y no repite la cotización", () => {
      expect(page).toContain("proposals.length > 0 && spotlightJob ?");
      expect(page).toContain(
        "openFromHeaderOnly={!currentUserIsClient || spotlightJob !== null}",
      );
      expect(composer).toContain("[&:not([open])]:hidden");
    });
  });
  describe("/jobs y /jobs/[id]", () => {
    const list = read("../../app/(account)/jobs/page.tsx");
    const detail = read("../../app/(account)/jobs/[jobId]/page.tsx");

    it("no repite el título ni la única fila en la lista", () => {
      expect(list).toMatch(/<h1 className="[^"]*max-sm:sr-only/);
      expect(list).toContain(
        "if (activeCount > 0 && !pendingPayment) return null;",
      );
    });

    it("quita el banner decorativo y el precio repetido del detalle", () => {
      expect(detail).not.toContain("Ficha ilustrada de");
      expect(detail).not.toMatch(
        /Con \{detail\.counterparty_name\} · \{price\}/,
      );
    });

    it("pone 'Qué sigue' antes del seguimiento y deja la barra sólo con acciones", () => {
      expect(detail.indexOf('id="proxima-accion"')).toBeLessThan(
        detail.indexOf('aria-label="Seguimiento del servicio"'),
      );
      expect(detail).toContain("{nextAction.kind || nextAction.href ? (");
      expect(detail).not.toContain('aria-label="Abrir chat del servicio"');
    });
  });
  describe("ajustes menores", () => {
    it("deja cerrar sesión y baja antes del pie en Configuración", () => {
      const settings = read("../../app/(account)/account/settings/page.tsx");
      expect(settings.indexOf("Eliminar mi cuenta")).toBeLessThan(
        settings.indexOf("<SiteFooter"),
      );
    });

    it("muestra los pasos antes del único botón de alta", () => {
      const onboarding = read(
        "../../app/(provider)/provider/onboarding/page.tsx",
      );
      const notStarted = onboarding.slice(
        0,
        onboarding.indexOf("const editable"),
      );
      expect(notStarted.indexOf("emptySteps.map")).toBeLessThan(
        notStarted.indexOf("<StartProviderForm"),
      );
      expect(notStarted).not.toContain("Empezá ahora.");
    });

    it("usa el margen del layout en necesidades y oportunidades", () => {
      for (const path of [
        "../../app/(account)/needs/page.tsx",
        "../../app/(account)/needs/new/page.tsx",
        "../../app/(account)/needs/[postId]/page.tsx",
        "../../app/(account)/oportunidades/page.tsx",
      ]) {
        expect(read(path)).not.toContain("max-w-2xl px-4 py-6 sm:px-8");
      }
      expect(read("../../app/(account)/needs/page.tsx")).toContain(
        "{posts.length > 0 ? (",
      );
    });

    it("evita que las filas de mensajes desborden la tarjeta", () => {
      expect(read("../../app/(account)/messages/page.tsx")).toContain(
        "grid grid-cols-[minmax(0,1fr)] divide-y",
      );
    });
  });
  describe("/provider/manage", () => {
    const page = read("../../app/(provider)/provider/manage/page.tsx");
    const management = read(
      "../../components/provider/marketplace-management.tsx",
    );

    it("muestra una sección por pestaña, con 'Resumen' primero", () => {
      expect(management).toContain('["resumen", "Resumen"]');
      expect(management).toContain('useState("resumen")');
      expect(management).toContain("hidden={!active}");
      for (const id of ["perfil", "servicios", "zonas", "disponibilidad"]) {
        expect(management).toContain(`active={activeSection === "${id}"}`);
      }
      expect(page).toContain("summary={summary}");
    });

    it("resume estado, ingresos y acciones en una tarjeta", () => {
      expect(page).toContain("function IncomeMetric");
      expect(page).toContain('className="mt-4 grid grid-cols-3 gap-2"');
      expect(page).not.toContain("Ver oportunidades para ofertar");
    });

    it("pliega los cobros online mientras no están disponibles", () => {
      expect(page).toContain("open={Boolean(paymentFeedback)}");
      expect(page).toContain("Próximamente · hoy cobrás directo");
    });

    it("hace de 'Editar' la acción principal de cada servicio", () => {
      expect(management).toContain("function ManagedServiceCard");
      expect(management).toContain('submitTone="secondary"');
      expect(management).not.toContain("Ver enlace técnico");
      expect(management).not.toContain('"Pausar servicio"');
    });
  });
  describe("cierre del trabajo", () => {
    const detail = read("../../app/(account)/jobs/[jobId]/page.tsx");
    const review = read("../../components/reputation/job-reputation-panel.tsx");

    it("ofrece pago y reseña desde 'Qué sigue'", () => {
      expect(detail).toContain('href: "#pago"');
      expect(detail).toContain('{ href: "#resena", label: "Dejar reseña" }');
      expect(detail).toContain("closingShortcuts.map");
    });

    it("no usa barra fija y actualiza el copy de la entrega", () => {
      expect(detail).not.toContain("yalo-job-mobile-cta");
      expect(detail).toContain('"Entrega aceptada."');
    });

    it("pone la calificación primero y recontratar al final", () => {
      expect(review).toContain(
        "Detallar calidad, puntualidad y comunicación (opcional)",
      );
      expect(review.indexOf("Publicar reseña")).toBeLessThan(
        review.indexOf("Volver a contratar"),
      );
    });
  });
  describe("alta de prestador", () => {
    const hub = read("../../app/(provider)/provider/onboarding/page.tsx");
    const review = read(
      "../../app/(provider)/provider/onboarding/review/page.tsx",
    );
    const documents = read(
      "../../app/(provider)/provider/onboarding/documents/page.tsx",
    );

    it("muestra un solo progreso y un solo botón en el resumen", () => {
      expect(hub).not.toContain("<NextStepBanner");
      expect(hub).not.toContain('aria-label="Pasos de verificación"');
      expect(hub.match(/href=\{primaryHref\}/g)).toHaveLength(1);
    });

    it("no fija un botón deshabilitado mientras faltan papeles", () => {
      expect(documents).toContain("{editable && documentsComplete ? (");
      expect(documents).not.toMatch(/type="button"\s*disabled/);
    });

    it("usa una sola lista y una sola salida en la revisión", () => {
      expect(review).not.toContain('aria-label="Lo que cargaste"');
      expect(review).toContain("<StepStatusChip complete={publicComplete} />");
      expect(review).not.toContain("Ir a mi cuenta");
    });
  });
  describe("/admin/catalog", () => {
    const catalog = read("../../app/admin/catalog/page.tsx");

    it("muestra una sección por pestaña", () => {
      expect(catalog).toContain("const CATALOG_TABS = [");
      expect(catalog).toContain("href={`?tab=${id}`}");
      expect(catalog).toContain('{tab === "sinonimos" ? (');
      expect(catalog).not.toContain('id="crear"');
    });

    it("deja el alta plegada y el borrado como enlace", () => {
      expect(catalog).toContain("+ Nueva categoría");
      expect(catalog).not.toContain("bg-danger inline-block cursor-pointer");
      expect(catalog).toContain("Cambiar estado");
    });
  });
  describe("modo oscuro, cards y retornos de pago", () => {
    it("invierte a claro el estado activo en oscuro", () => {
      expect(read("../../app/buscar/page.tsx")).toContain(
        "dark:bg-[#F5F8FC] dark:text-[#0D121B]",
      );
      expect(
        read("../../components/provider/marketplace-management.tsx"),
      ).toContain("bg-[#0D121B] text-white");
    });

    it("trunca la zona y no el nombre del prestador", () => {
      const card = read("../../components/ui/marketplace/service-card.tsx");
      expect(card).toContain(
        '<span className="shrink-0">{row.provider_display_name}</span>',
      );
      expect(card).toContain('<span className="min-w-0 truncate font-normal">');
    });

    it("da margen lateral a los retornos de pago", () => {
      for (const kind of ["success", "pending", "failure"]) {
        expect(read(`../../app/payments/return/${kind}/page.tsx`)).toContain(
          "px-4 py-16 sm:px-0",
        );
      }
    });
  });
  describe("admin usuarios y notificaciones", () => {
    it("pagina los usuarios y usa filas compactas", () => {
      const users = read("../../app/admin/users/page.tsx");
      const server = read("../../lib/admin/server.ts");
      expect(server).toContain(
        "page_offset: Math.max(0, page) * ADMIN_USERS_PAGE_SIZE",
      );
      expect(users).toContain('aria-label="Páginas de usuarios"');
      expect(users).not.toContain("Ver cuenta y permisos →");
    });

    it("pone 'Marcar' con el contenido y no junto a la hora", () => {
      const notifications = read(
        "../../app/(account)/account/notifications/page.tsx",
      );
      expect(notifications.indexOf("{item.body}")).toBeLessThan(
        notifications.indexOf("action={markNotificationReadAction}"),
      );
    });
  });
});
