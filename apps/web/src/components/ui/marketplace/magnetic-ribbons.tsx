"use client";

import { useEffect, useRef } from "react";

/**
 * YALO ambient magnetic ribbons. Decorative only: no heavy WebGL or CDN.
 * The effect is capped at 30fps, skips touch devices and honors reduced motion.
 */
export function MagneticRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    if (reduced.matches || !fine.matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastTime = 0;
    let running = true;
    let targetX = 0.52;
    let targetY = 0.47;
    let cursorX = targetX;
    let cursorY = targetY;

    function resize() {
      if (!canvas || !host) return;
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function move(event: PointerEvent) {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        targetX = 0.52;
        targetY = 0.47;
        return;
      }
      targetX = (event.clientX - rect.left) / Math.max(1, rect.width);
      targetY = (event.clientY - rect.top) / Math.max(1, rect.height);
    }

    function render(time: number) {
      if (!running || !ctx) return;
      frameId = window.requestAnimationFrame(render);
      if (time - lastTime < 33) return;
      lastTime = time;
      cursorX += (targetX - cursorX) * 0.042;
      cursorY += (targetY - cursorY) * 0.042;
      ctx.clearRect(0, 0, width, height);

      const t = time * 0.00025;
      const focusX = width * (0.65 + (cursorX - 0.52) * 0.19);
      const focusY = height * (0.42 + (cursorY - 0.47) * 0.21);
      const center = Math.min(width, height);

      // Curving, liquid-glass ribbons are rendered in layers for subtle depth.
      const palette = ["#08A9F4", "#12D9C5", "#65EC91", "#A5F3F5"];
      for (let strand = 0; strand < 9; strand++) {
        const depth = strand / 9;
        const radius = center * (0.27 + depth * 0.44);
        const offset = strand * 0.6 + t;
        const points: { x: number; y: number }[] = [];
        const segments = 70;

        for (let i = 0; i <= segments; i++) {
          const p = i / segments;
          const angle = p * Math.PI * 2.35 + offset;
          const swirl = 1 + Math.sin(angle * 2.4 + t * 1.1) * 0.17;
          const x =
            focusX +
            Math.cos(angle) * radius * swirl * 1.27 +
            Math.sin(p * 9 + offset) * center * 0.056;
          const y =
            focusY +
            Math.sin(angle) * radius * swirl * 0.75 +
            Math.cos(p * 8 + offset) * center * 0.055;
          points.push({ x, y });
        }

        const color = palette[strand % palette.length];
        ctx.beginPath();
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.13 + (1 - depth) * 0.23;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18 + (1 - depth) * 18;
        ctx.lineWidth = 7.5 - depth * 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.45 + (1 - depth) * 0.42;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const visibility = () => {
      running = document.visibilityState === "visible";
      if (running) frameId = requestAnimationFrame(render);
      else cancelAnimationFrame(frameId);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    resize();
    frameId = window.requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="yalo-magnetic-canvas" />;
}
