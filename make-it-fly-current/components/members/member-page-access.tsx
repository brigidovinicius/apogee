import { requireSignedInMember } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { calendarSaveAccess } from "@/lib/opportunities/personal-calendar";
import { MemberFeaturePreview } from "./member-feature-preview";
import type { LockedAreaKind } from "./locked-member-area";

export async function verificationPagePreview(kind: LockedAreaKind, title: string, next: string) {
  const member = await requireSignedInMember(next);
  if (await adultAccess(member.id)) return null;
  return <MemberFeaturePreview member={member} kind={kind} title={title} next={next} reason="verification" />;
}

export async function calendarPagePreview(kind: "calendario" | "colecoes", next: string) {
  const member = await requireSignedInMember(next);
  const access = await calendarSaveAccess(next);
  if (access.kind === "ready") return null;
  const reason = access.kind === "disabled" ? "unavailable" : access.href.startsWith("/membros/protecao") ? "verification" : "annual";
  return <MemberFeaturePreview member={member} kind={kind} title={kind === "calendario" ? "Meu calendário" : "Minhas coleções"} next={next} reason={reason} />;
}
