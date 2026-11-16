import { LockedMemberArea } from "@/components/members/locked-member-area";
export function AnnualAccessNotice({ title, next }: { title: string; next: string }) {
  return <LockedMemberArea kind={title === "Benefícios" ? "beneficios" : "trilha"} next={next} />;
}
