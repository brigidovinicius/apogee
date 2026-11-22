import type { Metadata } from "next";
import { EventLivePage } from "@/components/community/event-live-page";

export const metadata: Metadata = {
  title: "Gravação do Codex Community Workshop | Apogee",
  description: "Assista à gravação do Codex Community Workshop de Florianópolis, realizado em 21 de novembro de 2026.",
  alternates: { canonical: "https://www.apogee.community/evento-openai/ao-vivo" },
  robots: { index: false, follow: true },
};

export default async function EventLiveRoute({ searchParams }: { searchParams: Promise<{ inscricao?: string | string[] }> }) {
  const { inscricao } = await searchParams;
  return <EventLivePage registered={inscricao === "ok"} />;
}
