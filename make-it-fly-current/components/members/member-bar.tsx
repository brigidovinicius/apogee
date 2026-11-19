import Link from "next/link";
import { BookOpen, CalendarDays, Compass, Gift, House, Layers, MessageCircle, Newspaper, Wrench } from "lucide-react";
import { signOut } from "@/app/membros/actions";
import { AdminModeSwitcher } from "@/components/admin/admin-mode-switcher";
import type { CurrentMember } from "@/lib/members/dal";
import { AvatarInitials } from "./avatar-initials";
import { SignOutButton } from "./account-menu";
import { personalCalendarEnabled } from "@/lib/opportunities/personal-calendar";
import { collectionsEnabled } from "@/lib/opportunities/collections";
import { MemberNavigation } from "./member-navigation";
import { memberResourceAvailability } from "@/lib/members/resource-availability";
import { radarAccess } from "@/lib/billing/store";
import styles from "./member-navigation.module.css";

export type MemberSection = "home" | "forum" | "perfil" | "radar" | "calendario" | "colecoes" | "protecao" | "ferramentas" | "beneficios" | "trilha" | "assinatura" | "suporte" | "blog" | "integracoes";
export type MemberBarProps = { member: CurrentMember; current?: MemberSection };

export async function MemberBar({ member, current }: MemberBarProps) {
  const calendar = personalCalendarEnabled(), collections = collectionsEnabled();
  const [resources, radar] = await Promise.all([
    memberResourceAvailability(member.id, member.role),
    (calendar || collections) ? radarAccess(member.id, process.env.STRIPE_MODE !== "test", { claimPurchases: false }).catch(() => null) : null,
  ]);
  const links = [
    { key: "home", href: "/membros", label: "Início", icon: House },
    { key: "radar", href: "/membros/oportunidades", label: "Radar", icon: Compass },
    { key: "beneficios", href: "/membros/beneficios", label: "Benefícios", icon: Gift },
  ];
  const more = [
    ...(resources.trilha ? [{ key: "trilha", href: "/membros/trilha", label: "Trilha inicial", icon: BookOpen }] : []),
    ...(resources.ferramentas ? [{ key: "ferramentas", href: "/membros/ferramentas", label: "Caixa de ferramentas", icon: Wrench }] : []),
    ...(radar?.active && calendar ? [{ key: "calendario", href: "/membros/meu-calendario", label: "Meu calendário", icon: CalendarDays }] : []),
    ...(radar?.active && collections ? [{ key: "colecoes", href: "/membros/colecoes", label: "Minhas coleções", icon: Layers }] : []),
    { key: "blog", href: "/membros/blog", label: "Blog", icon: Newspaper },
    { key: "forum", href: "/membros#forum", label: "Fórum", icon: MessageCircle },
  ];
  const account = [
    { key: "perfil", href: `/membros/perfil/${member.username}`, label: "Meu perfil" },
    { key: "assinatura", href: "/membros/assinatura", label: "Assinatura e acesso" },
    { key: "protecao", href: "/membros/protecao", label: "Verificação da conta" },
    { key: "suporte", href: "/membros/suporte", label: "Suporte" },
  ];
  return <MemberNavigation>
    {member.role === "admin" ? <AdminModeSwitcher mode="user" compact /> : null}
    <div className={styles.identity}>
      <AvatarInitials name={member.name} userId={member.id} image={member.image} size="small" />
      <span>@{member.username}</span>
    </div>
    <nav aria-label="Navegação da área de membros" className={styles.links}>
      {links.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}><Icon size={18} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
    <details className={styles.account} open={more.some(link => link.key === current)}>
      <summary>Recursos</summary>
      <nav aria-label="Recursos da comunidade" className={styles.links}>
        {more.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>)}
      </nav>
    </details>
    <details className={styles.account} open={account.some(link => link.key === current)}>
      <summary>Minha conta</summary>
      <nav aria-label="Configurações da conta" className={styles.links}>
        {account.map(({ key, href, label }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}>{label}</Link>)}
      </nav>
      <form action={signOut}><SignOutButton compact /></form>
    </details>

  </MemberNavigation>;
}
