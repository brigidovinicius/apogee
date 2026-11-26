import Link from "next/link";
import { LockKeyhole, ArrowUpRight } from "lucide-react";
import styles from "./locked-member-area.module.css";

export type LockedAreaKind = "ferramentas" | "beneficios" | "trilha" | "forum" | "calendario" | "colecoes" | "perfil";
export type LockedAreaReason = "annual" | "verification" | "unavailable";
const previews: Record<LockedAreaKind, { name: string; items: string[] }> = {
  ferramentas: { name: "Caixa de ferramentas", items: ["Vídeo", "Imagem e design", "Áudio", "Texto e pesquisa", "Produtividade", "Programação"] },
  beneficios: { name: "Benefícios", items: ["Condições de acesso", "Elegibilidade", "Como resgatar"] },
  trilha: { name: "Trilha de Aprendizagem", items: ["Módulo", "Atividade", "Material de apoio"] },
  forum: { name: "Conversas da comunidade", items: ["Boas-vindas", "Ideias e projetos", "Dúvidas"] },
  calendario: { name: "Meu calendário", items: ["Oportunidades salvas", "Próximas etapas", "Combinações de filtros"] },
  colecoes: { name: "Minhas coleções", items: ["Seleções pessoais", "Organizar oportunidades", "Coleções acompanhadas"] },
  perfil: { name: "Meu perfil", items: ["Apresentação", "Suas informações", "Conversas da comunidade"] },
};

// These are presentation placeholders, never a blurred copy of private records.
// No catalogue, redemption link, lesson or personal data is accepted by this component.
export function LockedMemberArea({ kind, next, reason = "annual" }: { kind: LockedAreaKind; next: string; reason?: LockedAreaReason }) {
  const preview = previews[kind];
  const titles = {
    verification: "Conclua a verificação da conta",
    unavailable: kind === "trilha" ? "Em breve" : "Esta área está em preparação",
    annual: `${preview.name} para assinantes anuais`,
  };
  return <section className={styles.preview} aria-label={`${preview.name}: prévia com acesso restrito`}>
    <div className={styles.stage}>
      <div className={styles.skeleton} aria-hidden="true" inert data-locked-preview={kind}>
        {preview.items.map(item => <div key={item} className={styles.card}><span className={styles.icon} /><strong>{item}</strong><span className={styles.line} /><span className={styles.shortLine} /><span className={styles.control} /></div>)}
      </div>
      <div className={styles.notice}>
        <LockKeyhole size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2 data-ap-heading="" data-ap-art={kind}>{titles[reason]}</h2>
        {reason === "annual" && <p>Disponível durante a vigência da assinatura anual.</p>}
        {kind === "beneficios" ? <p className={styles.note}>Benefícios de parceiros em preparação.</p> : null}
        {kind === "ferramentas" ? <p className={styles.note}>Ferramentas de terceiros seguem suas próprias condições.</p> : null}
        <div className={styles.actions}>
          {reason === "verification" ? <Link className={styles.primary} href={`/membros/protecao?next=${encodeURIComponent(next)}`} prefetch={false}>Verificar minha conta <ArrowUpRight size={16} aria-hidden="true" /></Link> : reason === "annual" ? <Link className={styles.primary} href={`/comunidade?next=${encodeURIComponent(next)}#plano-anual`} prefetch={false}>Conhecer a assinatura anual <ArrowUpRight size={16} aria-hidden="true" /></Link> : null}
          <Link href="/membros/oportunidades">Continuar no Radar</Link>
        </div>
      </div>
    </div>
  </section>;
}
