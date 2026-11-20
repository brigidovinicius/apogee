import type { ReactNode } from "react";
import { MemberBar, type MemberBarProps } from "@/components/members/member-bar";
import styles from "./member-workspace.module.css";

export function MemberWorkspace({ member, current, children }: Omit<MemberBarProps, "member"> & { member: MemberBarProps["member"] | null; children: ReactNode }) {
  if (!member) return children;
  return <div className={styles.workspace}>
    <MemberBar member={member} current={current} />
    <div className={styles.content} id="conteudo-membro" data-ap-member-area="" data-ap-art={current ?? "home"} tabIndex={-1}>{children}</div>
  </div>;
}
