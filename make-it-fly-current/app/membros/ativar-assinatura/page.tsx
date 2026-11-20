import { requireSignedInMember } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";
import { AnnualActivation } from "@/components/members/annual-activation";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ativar assinatura | Apogee", robots: { index: false, follow: false } };
export default async function ActivateAnnualPage() {
  const member = await requireSignedInMember("/membros/ativar-assinatura");
  const [account] = await getSql()`select email_verified from "user" where id=${member.id} and blocked=false`;
  return <div className={styles.narrow}><h1 className={styles.title}>Ative sua assinatura</h1><AnnualActivation verified={Boolean(account?.email_verified)} /></div>;
}
