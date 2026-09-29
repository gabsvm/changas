import { waapi } from "animejs/waapi";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function animatePanelEntrance(root: HTMLElement): () => void {
  if (reducedMotion()) return () => {};

  const backdrop = root.querySelector<HTMLElement>("[data-motion-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-motion-panel]");
  if (!backdrop || !panel) return () => {};

  const animations = [
    waapi.animate(backdrop, {
      opacity: [0, 1],
      duration: 180,
      ease: "outQuad",
    }),
    waapi.animate(panel, {
      opacity: [0, 1],
      translate: ["0 12px", "0 0px"],
      duration: 220,
      ease: "outCubic",
    }),
  ];

  return () => animations.forEach((animation) => animation.revert());
}

export function animateConfirmedSave(
  target: HTMLElement,
  success: string | undefined,
): () => void {
  if (!success || reducedMotion()) return () => {};

  const animation = waapi.animate(target, {
    opacity: [0, 1],
    translate: ["0 4px", "0 0px"],
    duration: 180,
    ease: "outQuad",
  });

  return () => animation.revert();
}
