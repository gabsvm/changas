import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { createClient } from "@/lib/supabase/server";

export const alt = "Perfil de proveedor en Changas";
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
  const name = provider?.display_name ?? "Proveedor de Changas";
  const headline = (
    provider?.public_headline ??
    provider?.bio ??
    "Servicios publicados en Changas."
  ).slice(0, 140);
  const initial = name.trim().charAt(0).toUpperCase() || "C";

  const fonts = await loadBrandFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FFF9F3",
          fontFamily: '"Bricolage Grotesque", "Hanken Grotesk", sans-serif',
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 210,
            display: "flex",
            alignItems: "center",
            padding: "0 80px",
            backgroundImage:
              "linear-gradient(135deg, #FFC857 0%, #FF6B35 48%, #FF0A78 100%)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 9999,
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9999,
                border: "10px solid #FF6B35",
                borderRightColor: "transparent",
                transform: "rotate(-32deg)",
              }}
            />
          </div>
          <div
            style={{
              color: "#fff",
              fontSize: 44,
              fontWeight: 700,
              marginLeft: 20,
              letterSpacing: -1,
            }}
          >
            Changas
          </div>
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
                "linear-gradient(135deg, #FFC857 0%, #FF6B35 48%, #FF0A78 100%)",
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
                color: "#202124",
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
                color: "rgba(32,33,36,0.65)",
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
      </div>
    ),
    { ...size, fonts },
  );
}
