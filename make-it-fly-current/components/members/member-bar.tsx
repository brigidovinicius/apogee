import Link from "next/link";
import { AreaIcon } from "@/components/site/area-icon";
import { AdminModeSwitcher } from "@/components/admin/admin-mode-switcher";
import type { CurrentMember } from "@/lib/members/dal";
import { personalCalendarEnabled } from "@/lib/opportunities/personal-calendar";
import { collectionsEnabled } from "@/lib/opportunities/collections";
import { MemberNavigation } from "./member-navigation";
import { memberResourceAvailability } from "@/lib/members/resource-availability";
import { radarAccess } from "@/lib/billing/store";
import { EVENTS_PATH } from "@/lib/eventos/catalogo";
import styles from "./member-navigation.module.css";

export type MemberSection = "home" | "forum" | "perfil" | "radar" | "calendario" | "colecoes" | "protecao" | "ferramentas" | "beneficios" | "trilha" | "assinatura" | "suporte" | "blog" | "integracoes" | "eventos";
export type MemberBarProps = { member: CurrentMember; current?: MemberSection };

export async function MemberBar({ member, current }: MemberBarProps) {
  const calendar = personalCalendarEnabled(), collections = collectionsEnabled();
  const [resources, radar] = await Promise.all([
    memberResourceAvailability(member.id, member.role),
    (calendar || collections) ? radarAccess(member.id, process.env.STRIPE_MODE !== "test", { claimPurchases: false }).catch(() => null) : null,
  ]);
  const links = [
    { key: "home", href: "/membros", label: "Início" },
    { key: "radar", href: "/membros/oportunidades", label: "Radar" },
    { key: "beneficios", href: "/membros/beneficios", label: "Benefícios" },
    { key: "eventos", href: EVENTS_PATH, label: "Eventos" },
    ...(radar?.active && calendar ? [{ key: "calendario", href: "/membros/meu-calendario", label: "Meu calendário" }] : []),
    ...(radar?.active && collections ? [{ key: "colecoes", href: "/membros/colecoes", label: "Minhas coleções" }] : []),
  ];
  const more = [
    ...(resources.ferramentas ? [{ key: "ferramentas", href: "/membros/ferramentas", label: "Caixa de Ferramentas" }] : []),
    { key: "trilha", href: "/membros/trilha", label: "Trilha de Aprendizagem" },
    { key: "blog", href: "/membros/blog", label: "Blog" },
    { key: "forum", href: "/membros#forum", label: "Fórum" },
  ];
  return <MemberNavigation>
    {member.role === "admin" ? <AdminModeSwitcher mode="user" compact /> : null}
    <nav aria-label="Navegação da área de membros" className={styles.links}>
      {links.map(({ key, href, label }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}><AreaIcon area={key} /><span>{label}</span></Link>)}
    </nav>
    <details className={styles.resources} open={more.some(link => link.key === current)}>
      <summary><AreaIcon area="colecoes" />Recursos</summary>
      <nav aria-label="Recursos da comunidade" className={styles.links}>
        {more.map(({ key, href, label }) => <Link key={key} href={href} prefetch={false} aria-current={current === key ? "page" : undefined}><AreaIcon area={key} />{label}</Link>)}
      </nav>
    </details>
  </MemberNavigation>;
}
