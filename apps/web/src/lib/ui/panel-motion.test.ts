import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { animateConfirmedSave, animatePanelEntrance } from "./panel-motion";

function fakeElement() {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  return { element: { animate } as unknown as HTMLElement, animate, cancel };
}

describe("panel motion", () => {
  const backdrop = fakeElement();
  const panel = fakeElement();
  const target = fakeElement();
  const root = {
    querySelector: vi.fn((selector: string) =>
      selector === "[data-motion-backdrop]"
        ? backdrop.element
        : selector === "[data-motion-panel]"
          ? panel.element
          : null,
    ),
  } as unknown as HTMLElement;
  const matchMedia = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    matchMedia.mockReturnValue({ matches: false });
    vi.stubGlobal("window", { matchMedia });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("animates only the panel and its backdrop natively, then cancels both on close", () => {
    const stop = animatePanelEntrance(root);

    expect(backdrop.animate).toHaveBeenCalledOnce();
    expect(backdrop.animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({
        duration: 180,
        easing: "cubic-bezier(0.5, 1, 0.89, 1)",
      }),
    );
    expect(panel.animate).toHaveBeenCalledOnce();
    expect(panel.animate).toHaveBeenCalledWith(
      [
        { opacity: 0, translate: "0 12px" },
        { opacity: 1, translate: "0 0px" },
      ],
      expect.objectContaining({
        duration: 220,
        easing: "cubic-bezier(0.33, 1, 0.68, 1)",
      }),
    );

    stop();
    expect(backdrop.cancel).toHaveBeenCalledOnce();
    expect(panel.cancel).toHaveBeenCalledOnce();
  });

  it("does nothing when the panel markers are missing", () => {
    const empty = { querySelector: () => null } as unknown as HTMLElement;
    expect(() => animatePanelEntrance(empty)()).not.toThrow();
  });

  it("does not animate panels or save feedback when reduced motion is requested", () => {
    matchMedia.mockReturnValue({ matches: true });

    animatePanelEntrance(root);
    animateConfirmedSave(target.element, "Configuración guardada.");

    expect(backdrop.animate).not.toHaveBeenCalled();
    expect(panel.animate).not.toHaveBeenCalled();
    expect(target.animate).not.toHaveBeenCalled();
  });

  it("animates provider feedback only after a confirmed successful action", () => {
    animateConfirmedSave(target.element, undefined);
    expect(target.animate).not.toHaveBeenCalled();

    const stop = animateConfirmedSave(target.element, "Configuración guardada.");

    expect(target.animate).toHaveBeenCalledOnce();
    expect(target.animate).toHaveBeenCalledWith(
      [
        { opacity: 0, translate: "0 4px" },
        { opacity: 1, translate: "0 0px" },
      ],
      expect.objectContaining({
        duration: 180,
        easing: "cubic-bezier(0.5, 1, 0.89, 1)",
      }),
    );
    stop();
    expect(target.cancel).toHaveBeenCalledOnce();
  });
});
