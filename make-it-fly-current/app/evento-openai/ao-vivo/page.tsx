import type { Metadata } from "next";
import { EventLivePage } from "@/components/community/event-live-page";

export const metadata: Metadata = {
  title: "Ao vivo: Codex Community Workshop | Apogee",
  description: "Assista à transmissão do Codex Community Workshop, da comunidade OpenAI, organizado pela Apogee.",
  alternates: { canonical: "https://www.apogee.community/evento-openai/ao-vivo" },
  robots: { index: false, follow: true },
};

export default async function EventLiveRoute({ searchParams }: { searchParams: Promise<{ inscricao?: string | string[] }> }) {
  const { inscricao } = await searchParams;
  return <EventLivePage registered={inscricao === "ok"} />;
}
