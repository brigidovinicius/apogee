import Link from "next/link";
import { BookOpen, CalendarDays, Compass, Gift, House, Layers, MessageCircle, Newspaper, Wrench } from "lucide-react";
import { signOut } from "@/app/membros/actions";
import { AdminModeSwitcher } from "@/components/admin/admin-mode-switcher";
import type { CurrentMember } from "@/lib/members/dal";
import { AvatarInitials } from "./avatar-initials";
import { mcpEnabled } from "@/lib/mcp/config";
import { SignOutButton } from "./account-menu";
import { personalCalendarEnabled } from "@/lib/opportunities/personal-calendar";
import { collectionsEnabled } from "@/lib/opportunities/collections";
import { MemberNavigation } from "./member-navigation";
import styles from "./member-navigation.module.css";

export type MemberSection = "home" | "forum" | "perfil" | "radar" | "calendario" | "colecoes" | "protecao" | "ferramentas" | "beneficios" | "trilha" | "assinatura" | "suporte" | "blog" | "integracoes";
export type MemberBarProps = { member: CurrentMember; current?: MemberSection };

export function MemberBar({ member, current }: MemberBarProps) {
  const links = [
    { key: "home", href: "/membros", label: "Início", icon: House },
    { key: "trilha", href: "/membros/trilha", label: "Trilha de aprendizagem", icon: BookOpen },
    { key: "beneficios", href: "/membros/beneficios", label: "Benefícios", icon: Gift },
    { key: "ferramentas", href: "/membros/ferramentas", label: "Caixa de ferramentas", icon: Wrench },
    { key: "radar", href: "/membros/oportunidades", label: "Radar", icon: Compass },
    { key: "blog", href: "/membros/blog", label: "Blog", icon: Newspaper },
    { key: "forum", href: "/membros#forum", label: "Fórum", icon: MessageCircle },
    ...(personalCalendarEnabled() ? [{ key: "calendario", href: "/membros/meu-calendario", label: "Meu calendário", icon: CalendarDays }] : []),
    ...(collectionsEnabled() ? [{ key: "colecoes", href: "/membros/colecoes", label: "Minhas coleções", icon: Layers }] : []),
  ];
  const account = [
    { key: "perfil", href: `/membros/perfil/${member.username}`, label: "Meu perfil" },
    { key: "assinatura", href: "/membros/assinatura", label: "Assinatura" },
    { key: "protecao", href: "/membros/protecao", label: "Verificação da conta" },
    ...(mcpEnabled() ? [{ key: "integracoes", href: "/membros/integracoes/mcp", label: "ChatGPT e Claude" }] : []),
    { key: "suporte", href: "/membros/suporte", label: "Suporte" },
  ];
  return <MemberNavigation>
    {member.role === "admin" ? <AdminModeSwitcher mode="user" /> : null}
    <div className={styles.identity}>
      <AvatarInitials name={member.name} userId={member.id} image={member.image} size="small" />
      <span>@{member.username}</span>
      <form action={signOut}><SignOutButton compact /></form>
    </div>
    <nav aria-label="Navegação da área de membros" className={styles.links}>
      {links.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}><Icon size={18} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
    <details className={styles.account} open={account.some(link => link.key === current)}>
      <summary>Sua conta</summary>
      <nav aria-label="Configurações da conta" className={styles.links}>
        {account.map(({ key, href, label }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}>{label}</Link>)}
      </nav>
    </details>

  </MemberNavigation>;
}
