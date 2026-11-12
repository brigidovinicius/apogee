import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventRecordingPage } from "@/components/community/event-recording-page";

const description = "Receba o aviso de disponibilidade da gravação do evento Codex Community organizado pela Apogee. Gravação gratuita e comunidade opcional.";

export const metadata: Metadata = {
  title: "Gravação do evento Codex Community | Apogee",
  description,
  robots: { index: false, follow: false },
  openGraph: { title: "Continue aprendendo com a Apogee", description, locale: "pt_BR", type: "website" },
  twitter: { card: "summary", title: "Gravação Codex Community | Apogee", description },
};

export default function RecordingPage() {
  if (process.env.APOGEE_LOCAL_PREVIEW !== "1") notFound();
  return <EventRecordingPage />;
}
