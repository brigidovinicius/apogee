import Link from "next/link";
import { signOut } from "@/app/membros/actions";
import type { CurrentMember } from "@/lib/members/dal";
import { AvatarInitials } from "./avatar-initials";
import styles from "./members.module.css";

export function MemberBar({ member, current }: { member: CurrentMember; current?: "forum" | "perfil" | "radar" }) {
  return (
    <div className={styles.memberBar}>
      <nav aria-label="Área de membros">
        <Link href="/membros" aria-current={current === "forum" ? "page" : undefined}>
          Fórum
        </Link>
        <Link href="/membros/oportunidades" aria-current={current === "radar" ? "page" : undefined}>
          Radar
        </Link>
        <Link href={`/membros/perfil/${member.username}`} aria-current={current === "perfil" ? "page" : undefined}>
          Meu perfil
        </Link>
      </nav>
      <div className={styles.memberIdentity}>
        <AvatarInitials name={member.name} size="small" />
        <span>@{member.username}</span>
        <form action={signOut}>
          <button className={styles.linkButton} type="submit">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
