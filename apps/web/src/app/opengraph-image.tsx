import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "YALO — Trabajá · Contratá · Crecé";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadBrandFonts() {
  const [mediumData, boldData] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/inter-500.ttf")),
    readFile(join(process.cwd(), "public/fonts/space-grotesk-700.ttf")),
  ]);
  return [
    {
      name: "Inter",
      data: mediumData,
      weight: 500 as const,
      style: "normal" as const,
    },
    {
      name: "Space Grotesk",
      data: boldData,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

async function loadSymbolDataUri(file = "yalo-symbol.svg"): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public/brand", file), "utf8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function Image() {
  const [fonts, symbolSrc, wordmarkSrc] = await Promise.all([
    loadBrandFonts(),
    loadSymbolDataUri(),
    loadSymbolDataUri("yalo-wordmark-white.svg"),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        backgroundColor: "#0D121B",
        backgroundImage: "linear-gradient(180deg, #161D2A 0%, #0D121B 100%)",
        padding: "72px 80px",
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -120,
          width: 420,
          height: 420,
          borderRadius: 9999,
          backgroundImage:
            "linear-gradient(115deg, #08A9F4 0%, #12D9C5 52%, #65EC91 100%)",
          opacity: 0.16,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: 800,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={symbolSrc}
            alt=""
            width={96}
            height={77}
            style={{ width: 96, height: 77 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wordmarkSrc}
            alt="YALO"
            width={300}
            height={64}
            style={{ width: 300, height: 64, marginLeft: 28 }}
          />
        </div>
        <div
          style={{
            color: "#65EC91",
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 4,
            marginTop: 36,
          }}
        >
          TRABAJÁ · CONTRATÁ · CRECÉ
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 40,
            fontWeight: 500,
            lineHeight: 1.25,
            marginTop: 12,
            letterSpacing: -1,
          }}
        >
          Una base confiable para conectar habilidades con oportunidades.
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
