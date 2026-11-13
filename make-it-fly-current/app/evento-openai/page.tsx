import type { Metadata } from "next";
import { EventRecordingPage } from "@/components/community/event-recording-page";

const description = "Inscreva-se gratuitamente no evento Codex Community, da comunidade OpenAI, organizado pela Apogee, e explore como a IA pode ajudar no trabalho e na rotina.";
export const metadata: Metadata = {
  title: "Evento gratuito Codex Community | Apogee",
  description,
  alternates: { canonical: "https://www.apogee.community/evento-openai" },
  openGraph: { title: "Descubra o que a IA pode mudar na sua vida", description, url: "https://www.apogee.community/evento-openai", locale: "pt_BR", type: "website" },
  twitter: { card: "summary", title: "Evento gratuito Codex Community | Apogee", description },
};
export default function OpenAIEventPage() { return <EventRecordingPage />; }
