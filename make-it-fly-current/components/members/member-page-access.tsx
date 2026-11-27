import { requireSignedInMember } from "@/lib/members/dal";
import { calendarSaveAccess } from "@/lib/opportunities/personal-calendar";
import { MemberFeaturePreview } from "./member-feature-preview";
export async function calendarPagePreview(kind: "calendario" | "colecoes", next: string) {
  const member = await requireSignedInMember(next);
  const access = await calendarSaveAccess(next);
  if (access.kind === "ready") return null;
  const reason = access.kind === "disabled" ? "unavailable" : "annual";
  return <MemberFeaturePreview member={member} kind={kind} title={kind === "calendario" ? "Meu calendário" : "Minhas coleções"} next={next} reason={reason} />;
}
