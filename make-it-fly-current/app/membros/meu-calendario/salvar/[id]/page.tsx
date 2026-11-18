import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { CalendarSaveProvider, SaveOpportunityButton } from "@/components/opportunities/save-opportunity";
import { calendarSavePath } from "@/lib/opportunities/calendar-navigation";
import { calendarSaveState, requireCalendarMember } from "@/lib/opportunities/personal-calendar";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import styles from "@/components/members/members.module.css";

export const metadata = { title: "Salvar oportunidade | Apogee", robots: { index: false, follow: false } };

export default async function SavePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}) {
  const { id } = await params;
  if (!/^radar-[A-Za-z0-9_-]{1,194}$/.test(id)) notFound();
  const { voltar } = await searchParams;
  const intent = calendarSavePath(id, typeof voltar === "string" ? voltar : "");
  const back = new URL(intent, "https://apogee.invalid").searchParams.get("voltar")!;
  const member = await requireCalendarMember(intent);
  const items = await listRadarOpportunities(true);
  const item = items.find(opportunity => opportunity.id === id);
  if (!item) notFound();
  const state = await calendarSaveState([id], intent);
  return <MemberWorkspace member={member} current="calendario"><div className={styles.container}>
    <p className={styles.eyebrow}>Minha agenda</p>
    <h1 className={styles.title}>{item.title}</h1>
    <CalendarSaveProvider state={state} returnTo={intent}><SaveOpportunityButton id={id} title={item.title} /></CalendarSaveProvider>
    <p><Link href={back}>{back.startsWith("/membros/oportunidades") ? "Voltar aos resultados" : back.startsWith("/membros/colecoes") ? "Voltar às coleções" : "Voltar à minha agenda"}</Link></p>
  </div></MemberWorkspace>;
}
