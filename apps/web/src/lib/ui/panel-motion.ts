// Web Animations API nativa: sin dependencias de animación en el bundle.
// Curvas equivalentes a outQuad / outCubic (easings.net).
const OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";
const OUT_CUBIC = "cubic-bezier(0.33, 1, 0.68, 1)";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function animatePanelEntrance(root: HTMLElement): () => void {
  if (reducedMotion()) return () => {};

  const backdrop = root.querySelector<HTMLElement>("[data-motion-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-motion-panel]");
  if (!backdrop || !panel) return () => {};

  const animations = [
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: OUT_QUAD,
    }),
    panel.animate(
      [
        { opacity: 0, translate: "0 12px" },
        { opacity: 1, translate: "0 0px" },
      ],
      { duration: 220, easing: OUT_CUBIC },
    ),
  ];

  return () => animations.forEach((animation) => animation.cancel());
}

export function animateConfirmedSave(
  target: HTMLElement,
  success: string | undefined,
): () => void {
  if (!success || reducedMotion()) return () => {};

  const animation = target.animate(
    [
      { opacity: 0, translate: "0 4px" },
      { opacity: 1, translate: "0 0px" },
    ],
    { duration: 180, easing: OUT_QUAD },
  );

  return () => animation.cancel();
}
