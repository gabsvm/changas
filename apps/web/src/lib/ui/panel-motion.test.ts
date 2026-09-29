import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { animate } = vi.hoisted(() => ({
  animate: vi.fn(() => ({ revert: vi.fn() })),
}));

vi.mock("animejs/waapi", () => ({ waapi: { animate } }));

import { animateConfirmedSave, animatePanelEntrance } from "./panel-motion";

describe("panel motion", () => {
  const backdrop = { role: "backdrop" } as unknown as HTMLElement;
  const panel = { role: "panel" } as unknown as HTMLElement;
  const target = { role: "save-confirmation" } as unknown as HTMLElement;
  const root = {
    querySelector: vi.fn((selector: string) =>
      selector === "[data-motion-backdrop]" ? backdrop : panel,
    ),
  } as unknown as HTMLElement;
  const matchMedia = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    matchMedia.mockReturnValue({ matches: false });
    vi.stubGlobal("window", { matchMedia });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("animates only the panel and its backdrop, then reverts both on close", () => {
    const stop = animatePanelEntrance(root);

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenNthCalledWith(
      1,
      backdrop,
      expect.objectContaining({ opacity: [0, 1] }),
    );
    expect(animate).toHaveBeenNthCalledWith(
      2,
      panel,
      expect.objectContaining({
        opacity: [0, 1],
        translate: ["0 12px", "0 0px"],
      }),
    );

    stop();
    expect(animate.mock.results[0]?.value.revert).toHaveBeenCalledOnce();
    expect(animate.mock.results[1]?.value.revert).toHaveBeenCalledOnce();
  });

  it("does not animate panels or save feedback when reduced motion is requested", () => {
    matchMedia.mockReturnValue({ matches: true });

    animatePanelEntrance(root);
    animateConfirmedSave(target, "Configuración guardada.");

    expect(animate).not.toHaveBeenCalled();
  });

  it("animates provider feedback only after a confirmed successful action", () => {
    animateConfirmedSave(target, undefined);
    expect(animate).not.toHaveBeenCalled();

    const stop = animateConfirmedSave(target, "Configuración guardada.");

    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        opacity: [0, 1],
        translate: ["0 4px", "0 0px"],
      }),
    );
    stop();
    expect(animate.mock.results[0]?.value.revert).toHaveBeenCalledOnce();
  });
});
