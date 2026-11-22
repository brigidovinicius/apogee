import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EventLivePage } from "@/components/community/event-live-page";
import { EVENT_ACCESS_COOKIE, hasEventAccess } from "@/lib/community/event-access";

export const metadata: Metadata = {
  title: "Gravação do Codex Community Workshop | Apogee",
  description: "Assista à gravação do Codex Community Workshop de Florianópolis, realizado em 21 de novembro de 2026.",
  alternates: { canonical: "https://www.apogee.community/evento-openai/ao-vivo" },
  robots: { index: false, follow: true },
};

export default async function EventLiveRoute() {
  const receipt = (await cookies()).get(EVENT_ACCESS_COOKIE)?.value;
  if (!hasEventAccess(receipt)) redirect("/evento-openai#inscricao");
  return <EventLivePage />;
}
