import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar Acadêmico",
  description: "Oportunidades públicas de fontes oficiais, verificadas e organizadas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}