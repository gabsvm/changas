import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const previewSource = readFileSync(
  new URL("../../components/conversations/image-lightbox.tsx", import.meta.url),
  "utf8",
);
const threadSource = readFileSync(
  new URL(
    "../../components/conversations/conversation-thread.tsx",
    import.meta.url,
  ),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("../../app/p/[slug]/[serviceSlug]/page.tsx", import.meta.url),
  "utf8",
);

describe("chat image viewer and service conversion", () => {
  it("opens images within an accessible app modal, preserving normal file links", () => {
    expect(threadSource).toContain("<ConversationAttachmentCard");
    expect(previewSource).toContain("onClick={() => setPreviewOpen(true)}");
    expect(previewSource).toContain("<ImageLightbox");
    expect(previewSource).toContain("createPortal(");
    expect(previewSource).toContain('role="dialog"');
    expect(previewSource).toContain('aria-modal="true"');
    expect(previewSource).toContain("useDialogFocus(");
    expect(previewSource).toContain('target="_blank"');
    expect(previewSource).toContain("isImage ? (");
  });

  it("shows the service action before the banner and details", () => {
    expect(serviceSource).toContain('aria-label="Cotización y contratación"');
    expect(serviceSource.indexOf("service-hire-top")).toBeLessThan(
      serviceSource.indexOf("service-hero-card"),
    );
    expect(serviceSource).toContain("startServiceConversation");
    expect(serviceSource).toContain("<ConsultButton");
    expect(serviceSource).not.toContain("service-cta-bar-no-nav");
  });
});
