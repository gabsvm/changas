import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt =
  "Changas — Una base confiable para conectar habilidades con oportunidades";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadBrandFonts() {
  const [mediumData, boldData] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/hanken-grotesk-500.ttf")),
    readFile(join(process.cwd(), "public/fonts/bricolage-grotesque-700.ttf")),
  ]);
  return [
    {
      name: "Hanken Grotesk",
      data: mediumData,
      weight: 500 as const,
      style: "normal" as const,
    },
    {
      name: "Bricolage Grotesque",
      data: boldData,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

export default async function Image() {
  const fonts = await loadBrandFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          backgroundImage:
            "linear-gradient(135deg, #FFC857 0%, #FF6B35 48%, #FF0A78 100%)",
          padding: "72px 80px",
          position: "relative",
          overflow: "hidden",
          fontFamily: '"Bricolage Grotesque", "Hanken Grotesk", sans-serif',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -110,
            top: -110,
            width: 460,
            height: 460,
            borderRadius: 9999,
            border: "72px solid rgba(255,255,255,0.28)",
            borderRightColor: "transparent",
            transform: "rotate(-32deg)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 780,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 9999,
                backgroundColor: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 9999,
                  border: "13px solid #FF6B35",
                  borderRightColor: "transparent",
                  transform: "rotate(-32deg)",
                }}
              />
            </div>
            <div
              style={{
                color: "#fff",
                fontSize: 64,
                fontWeight: 700,
                marginLeft: 24,
                letterSpacing: -2,
              }}
            >
              Changas
            </div>
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: 4,
              marginTop: 36,
            }}
          >
            SERVICIOS Y HABILIDADES
          </div>
          <div
            style={{
              color: "#fff",
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: 12,
              letterSpacing: -1,
            }}
          >
            Una base confiable para conectar habilidades con oportunidades.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
