import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Wrench, FolderOpen } from "lucide-react";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { MemberBar } from "@/components/members/member-bar";
import memberStyles from "@/components/members/members.module.css";
import { memberToolbox } from "@/lib/toolbox/store";
import styles from "./toolbox.module.css";

export const metadata: Metadata = { title: "Caixa de ferramentas | Apogee", robots: { index:false,follow:false } };
export default async function MemberToolboxPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const query = await searchParams;
  const selected = typeof query.categoria === "string" ? query.categoria : null;
  const { member, access, categories, tools } = await memberToolbox(selected);
  if (access.allowed && selected && !categories.some(c => c.slug === selected)) notFound();
  return <div className={memberStyles.container}>
    <MemberBar member={member} current="ferramentas" />
    <header className={styles.header}><div className={styles.eyebrow}><Wrench size={17} aria-hidden="true" /> Recursos da comunidade</div>
      <h1>Caixa de ferramentas</h1><p>Encontre um recurso para a tarefa que você quer realizar. Links selecionados e organizados pela Apogee.</p>
    </header>
    {!access.allowed ? <LockedMemberArea kind="ferramentas" next="/membros/ferramentas" /> : <>
      {access.source === "admin" ? <p className={styles.preview}>Prévia administrativa · <Link href="/admin/ferramentas">Organizar ferramentas</Link></p> : <p className={styles.access}>Incluída na sua assinatura anual. Abrir ferramentas não consome consultas do Radar.</p>}
      {!categories.length ? <section className={styles.empty}><FolderOpen size={30} strokeWidth={1.5} aria-hidden="true" /><h2>Estamos organizando a caixa.</h2><p>As ferramentas aparecerão aqui conforme a curadoria publicar as primeiras fichas.</p><Link href="/membros">Voltar para a comunidade</Link></section> : <>
        <nav className={styles.categories} aria-label="Categorias de ferramentas"><Link href="/membros/ferramentas" prefetch={false} aria-current={!selected ? "page" : undefined}>Todas <span>{categories.reduce((sum,c) => sum+c.count,0)}</span></Link>{categories.map(c => <Link key={c.slug} href={`/membros/ferramentas?categoria=${encodeURIComponent(c.slug)}`} prefetch={false} aria-current={selected === c.slug ? "page" : undefined}>{c.name} <span>{c.count}</span></Link>)}</nav>
        <div className={styles.groups}>{categories.filter(c => !selected || c.slug === selected).map(c => <section key={c.slug} aria-labelledby={`category-${c.slug}`} className={styles.group}>
          <div className={styles.groupHead}><h2 id={`category-${c.slug}`}>{c.name}</h2>{c.description ? <p>{c.description}</p> : null}</div>
          <ul className={styles.tools}>{tools.filter(t => t.categorySlug === c.slug).map(t => <li className={styles.tool} key={t.id}>
            <div><p className={styles.domain}>{new URL(t.url).hostname.replace(/^www\./,'')}</p><h3>{t.name}</h3><p className={styles.description}>{t.description}</p>{t.conditions ? <p className={styles.conditions}>{t.conditions}</p> : null}</div>
            <a className={styles.open} href={t.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir ferramenta <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> {t.name} (abre em nova aba)</span></a>
          </li>)}</ul>
        </section>)}</div>
        <p className={styles.footer}>Cada ferramenta tem suas próprias condições de acesso. A assinatura da Apogee não inclui contas, planos pagos ou créditos dos serviços listados.</p>
      </>}
    </>}
  </div>;
}
