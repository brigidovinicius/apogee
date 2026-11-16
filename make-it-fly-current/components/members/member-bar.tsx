import Link from "next/link";
import { signOut } from "@/app/membros/actions";
import { AdminModeSwitcher } from "@/components/admin/admin-mode-switcher";
import type { CurrentMember } from "@/lib/members/dal";
import { AvatarInitials } from "./avatar-initials";
import styles from "./members.module.css";
import { mcpEnabled } from "@/lib/mcp/config";

export function MemberBar({ member, current }: { member: CurrentMember; current?: "home" | "forum" | "perfil" | "radar" | "ferramentas" | "beneficios" | "trilha" | "assinatura" | "suporte" }) {
  return (
    <div className={styles.memberBar}>
      {member.role === "admin" ? <AdminModeSwitcher mode="user" /> : null}
      <nav aria-label="Navegação da área de membros">
        <span className={styles.memberNavLabel}>Área de membros</span>
        <Link href="/membros" aria-current={current === "home" ? "page" : undefined}>
          Minha comunidade
        </Link>
        <Link href="/membros#forum" aria-current={current === "forum" ? "page" : undefined}>
          Fórum
        </Link>
        <Link href="/membros/oportunidades" aria-current={current === "radar" ? "page" : undefined}>
          Radar
        </Link>
        <Link href="/membros/ferramentas" prefetch={false} aria-current={current === "ferramentas" ? "page" : undefined}>
          Caixa de ferramentas
        </Link>
        <Link href={`/membros/perfil/${member.username}`} aria-current={current === "perfil" ? "page" : undefined}>
          Meu perfil
        </Link>
        <Link href="/membros/beneficios" aria-current={current === "beneficios" ? "page" : undefined}>Benefícios</Link>
        <Link href="/membros/trilha" aria-current={current === "trilha" ? "page" : undefined}>Trilha</Link>
        <Link href="/membros/assinatura" aria-current={current === "assinatura" ? "page" : undefined}>Assinatura</Link>
        <Link href="/membros/suporte" aria-current={current === "suporte" ? "page" : undefined}>Suporte</Link>
        <Link href="/membros/protecao">Cadastro protegido</Link>
        {mcpEnabled() && <Link href="/membros/integracoes/mcp">Incluir no meu ChatGPT</Link>}
        {mcpEnabled() && <Link href="/membros/integracoes/mcp#claude">Incluir no meu Claude</Link>}
      </nav>
      <div className={styles.memberIdentity}>
        <AvatarInitials name={member.name} userId={member.id} image={member.image} size="small" />
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
