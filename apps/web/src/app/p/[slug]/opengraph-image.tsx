import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { createClient } from "@/lib/supabase/server";

export const alt = "Perfil de proveedor en YALO";
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

async function loadProvider(slug: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_provider_profiles")
      .select("display_name, public_headline, bio")
      .eq("public_slug", slug)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provider = await loadProvider(slug);
  const name = provider?.display_name ?? "Proveedor de YALO";
  const headline = (
    provider?.public_headline ??
    provider?.bio ??
    "Servicios publicados en YALO."
  ).slice(0, 140);
  const initial = name.trim().charAt(0).toUpperCase() || "Y";

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
        flexDirection: "column",
        backgroundColor: "#0D121B",
        fontFamily: '"Space Grotesk", "Inter", sans-serif',
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 210,
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          backgroundImage: "linear-gradient(180deg, #161D2A 0%, #0D121B 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={symbolSrc}
          alt=""
          width={72}
          height={58}
          style={{ width: 72, height: 58 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wordmarkSrc}
          alt="YALO"
          width={206}
          height={44}
          style={{ width: 206, height: 44, marginLeft: 20 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "56px 80px",
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 9999,
            backgroundImage:
              "linear-gradient(115deg, #08A9F4 0%, #12D9C5 52%, #65EC91 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: 72,
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 40,
            maxWidth: 830,
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: name.length > 24 ? 60 : 80,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 34,
              fontWeight: 500,
              lineHeight: 1.3,
              marginTop: 12,
              overflow: "hidden",
            }}
          >
            {headline}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 80px 48px",
          color: "#65EC91",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 4,
        }}
      >
        TRABAJÁ · CONTRATÁ · CRECÉ
      </div>
    </div>,
    { ...size, fonts },
  );
}
