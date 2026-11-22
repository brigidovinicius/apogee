import type { Metadata } from "next";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { MemberWorkspace } from "@/components/members/member-workspace";
import styles from "@/components/members/members.module.css";
import { requireSignedInMember } from "@/lib/members/dal";

export const metadata: Metadata = {
  title: "Trilha de Aprendizagem",
  robots: { index: false, follow: false },
};

export default async function LearningPage() {
  const member = await requireSignedInMember("/membros/trilha");

  return (
    <MemberWorkspace member={member} current="trilha">
      <div className={styles.container}>
        <header className={styles.pageHead}>
          <h1 className={styles.title}>Trilha de Aprendizagem</h1>
        </header>
        <LockedMemberArea kind="trilha" next="/membros/trilha" reason="unavailable" />
      </div>
    </MemberWorkspace>
  );
}
