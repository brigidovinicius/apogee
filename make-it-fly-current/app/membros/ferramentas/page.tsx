import { toolboxReturnPath } from "@/lib/billing/community-navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { ResourceHeader } from "@/components/members/resource-header";
import navigation from "@/components/members/resource-header.module.css";
import memberStyles from "@/components/members/members.module.css";
import { memberToolbox } from "@/lib/toolbox/store";
import styles from "./toolbox.module.css";

export const metadata: Metadata = { title: "Caixa de ferramentas | Apogee", robots: { index: false, follow: false } };
const toolboxPath = "/membros/ferramentas";
const skillsCategory = "skills";
const skillsPath = toolboxPath + "?categoria=" + skillsCategory;
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default async function MemberToolboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selected = typeof params.categoria === "string" && params.categoria ? params.categoria : null;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const skills = selected === skillsCategory;
  const { member, access, categories, tools } = await memberToolbox(selected);
  if (access.allowed && selected && !skills && !categories.some(c => c.slug === selected)) notFound();
  const toolCategories = categories.filter(c => c.slug !== skillsCategory);
  const groups = skills ? categories.filter(c => c.slug === skillsCategory) : toolCategories;
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const matches = tools.filter(tool => {
    if (skills !== (tool.categorySlug === skillsCategory)) return false;
    const text = searchText([tool.name, tool.description, tool.categoryName, new URL(tool.url).hostname].join(" "));
    return terms.every(term => text.includes(term));
  });
  const noun = skills ? "skill" : "ferramenta";
  const sectionPath = skills ? skillsPath : toolboxPath;
  const filtered = Boolean(query || (selected && !skills));
  return <MemberWorkspace member={member} current="ferramentas"><div data-ap-toolbox="" className={`${memberStyles.container} ${styles.catalogue}`}>
    <ResourceHeader area="ferramentas" />
    {!access.allowed ? <LockedMemberArea kind="ferramentas" next={toolboxReturnPath(selected)} /> : <>
      <nav className={navigation.tabs} aria-label="Seções da Caixa de ferramentas">
        <Link href={toolboxPath} aria-current={!skills ? "page" : undefined}>Ferramentas</Link>
        <Link href={skillsPath} aria-current={skills ? "page" : undefined}>Skills</Link>
      </nav>
      {groups.length > 0 && <form action={toolboxPath} method="get" role="search" aria-label={skills ? "Buscar skills" : "Buscar ferramentas"} className={navigation.filters}>
        <label>Buscar {noun}<span className={navigation.searchInput}><Search size={17} aria-hidden="true" /><input type="search" name="q" defaultValue={query} placeholder="Nome ou tarefa" maxLength={100} /></span></label>
        {skills ? <input type="hidden" name="categoria" value={skillsCategory} /> : <label>Categoria<select name="categoria" defaultValue={selected ?? ""}>
          <option value="">Todas as categorias</option>{toolCategories.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
        </select></label>}
        <button data-ap-button="primary" type="submit">Buscar</button>
        {filtered && matches.length > 0 && <Link href={sectionPath}>Limpar filtros</Link>}
      </form>}
      {matches.length > 0 ? <>
        <p role="status" className={styles.count}>{matches.length} {noun}{matches.length === 1 ? "" : "s"}{query && ` para “${query}”`}</p>
        <div className={styles.groups}>{groups.map(c => {
          const items = matches.filter(t => t.categorySlug === c.slug);
          if (!items.length) return null;
          return <section key={c.slug} aria-labelledby={`category-${c.slug}`} className={styles.group}>
            <div className={styles.groupHead}><h2 id={`category-${c.slug}`}>{c.name}</h2>{c.description && <p>{c.description}</p>}</div>
            <ul className={styles.tools}>{items.map(t => <li data-ap-card="" className={styles.tool} key={t.id}>
              <div><p className={styles.domain}>{new URL(t.url).hostname.replace(/^www\./, "")}</p><h3>{t.name}</h3><p className={styles.description}>{t.description}</p>{t.conditions && <p className={styles.conditions}>{t.conditions}</p>}</div>
              <a data-ap-button="primary" className={styles.open} href={t.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                {skills ? "Abrir skill" : "Abrir ferramenta"}<ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> {t.name} (abre em nova aba)</span>
              </a>
            </li>)}</ul>
          </section>;
        })}</div>
        <p className={styles.footer}>Os links abrem em uma nova aba. Planos e créditos seguem as condições de cada fornecedor.</p>
      </> : <section className={styles.empty}>
        <h2>{filtered ? "Nenhum resultado para esses filtros" : skills ? "Skills em preparação" : "Ferramentas em preparação"}</h2>
        <p>{filtered ? "Tente outro termo ou limpe os filtros para ver as opções disponíveis." : skills ? "As instruções reutilizáveis para seus assistentes de IA aparecerão aqui à medida que forem publicadas." : "As ferramentas aparecerão aqui quando forem publicadas."}</p>
        <Link href={filtered ? sectionPath : skills ? toolboxPath : "/membros"}>{filtered ? "Limpar filtros" : skills ? "Explorar ferramentas" : "Voltar para a comunidade"}</Link>
      </section>}
    </>}
  </div></MemberWorkspace>;
}
