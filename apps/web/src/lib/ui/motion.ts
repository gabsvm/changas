import type { CSSProperties } from "react";

// Stagger index for the .rise-in entrance animation (capped so long lists
// do not wait seconds before the last row appears).
export function riseStyle(index: number): CSSProperties {
  return { "--i": Math.min(index, 8) } as CSSProperties;
}
