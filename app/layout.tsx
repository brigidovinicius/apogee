import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: "variable",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Make it fly | Florianópolis · Setembro 2026",
  description:
    "Um dia de coworking, comunidade e foco para tirar uma ideia do papel. Primeira edição em Florianópolis, com 40 participantes e apoio oficial da Red Bull.",
  openGraph: {
    title: "Make it fly | Tire uma ideia do papel",
    description:
      "Coworking, comunidade e foco. Florianópolis · Setembro 2026.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Make it fly | Tire uma ideia do papel",
    description:
      "Coworking, comunidade e foco. Florianópolis · Setembro 2026.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${ibmPlexSans.variable} ${dmMono.variable} dark h-full antialiased`}
    >
      <head>
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col bg-flight-ink font-sans text-flight-white">
        <a className="skip-link" href="#experiencia">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
