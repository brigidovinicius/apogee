import type { Metadata } from "next";
import { cookies } from "next/headers";
import { localStaticOfferPreview } from "@/lib/offer-preview";
import { EventRecordingPage } from "@/components/community/event-recording-page";
import { EVENT_ACCESS_COOKIE, hasEventAccess } from "@/lib/community/event-access";

const description = "Inscreva-se gratuitamente para assistir à gravação do Codex Community Workshop de Florianópolis.";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Evento gratuito Codex Community | Apogee",
  description,
  alternates: { canonical: "https://www.apogee.community/evento-openai" },
  openGraph: { title: "Descubra o que a IA pode mudar na sua vida", description, url: "https://www.apogee.community/evento-openai", locale: "pt_BR", type: "website" },
  twitter: { card: "summary", title: "Evento gratuito Codex Community | Apogee", description },
};
export default async function OpenAIEventPage() {
  const preview = localStaticOfferPreview();
  const registered = !preview && hasEventAccess((await cookies()).get(EVENT_ACCESS_COOKIE)?.value);
  return <EventRecordingPage preview={preview} registered={registered} />;
}
