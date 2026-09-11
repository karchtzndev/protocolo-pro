import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protocolo.Pro",
  description: "Plataforma de prescrição nutricional para nutricionistas e pacientes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
