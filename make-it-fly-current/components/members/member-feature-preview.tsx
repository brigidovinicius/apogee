import { MemberBar } from "@/components/members/member-bar";
import { LockedMemberArea, type LockedAreaKind, type LockedAreaReason } from "./locked-member-area";
import type { CurrentMember } from "@/lib/members/dal";
import styles from "./members.module.css";

export function MemberFeaturePreview({ member, kind, title, next, reason }: { member: CurrentMember; kind: LockedAreaKind; title: string; next: string; reason: LockedAreaReason }) {
  return <div className={styles.container}>
    <MemberBar member={member} current={kind} />
    <header className={styles.pageHead}><div><p className={styles.eyebrow}>Sua comunidade Apogee</p><h1 className={styles.title}>{title}</h1></div></header>
    <LockedMemberArea kind={kind} next={next} reason={reason} />
  </div>;
}
