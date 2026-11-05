import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
