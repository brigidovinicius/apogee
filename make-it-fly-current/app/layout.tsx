import type { Metadata } from "next";
import { GFS_Didot } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { JourneyTracker } from "@/components/analytics/JourneyTracker";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-variable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const didot = GFS_Didot({
  variable: "--font-gfs-didot",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const notoMono = localFont({
  src: "./fonts/noto-sans-mono-latin-variable.woff2",
  variable: "--font-noto-mono",
  weight: "400 500",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmMono = localFont({
  src: [
    {
      path: "./fonts/dm-mono-300-latin.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/dm-mono-400-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/dm-mono-500-latin.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.apogee.community"),
  robots: { index: true, follow: true },
  title: "Apogee",
  description: "Apogee: comunidade e experiências para tirar ideias do papel. Conheça o Make It Fly.",
  openGraph: {
    title: "Apogee",
    description: "Comunidade e experiências para tirar ideias do papel.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Apogee",
    description: "Comunidade e experiências para tirar ideias do papel.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${didot.variable} ${instrumentSerif.variable} ${dmMono.variable} ${notoMono.variable} dark h-full antialiased`}
    >
      <head>
        <noscript>
          <style>
            {
              "[data-reveal],[data-v2-reveal]{opacity:1!important;transform:none!important}"
            }
          </style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col bg-flight-ink font-sans text-flight-white">
        <JourneyTracker />
        <a className="skip-link" href="#experiencia">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
