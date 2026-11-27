import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { ProductMark } from "@/components/site/product-mark";
import { productDomain } from "@/lib/brand/domain";
import { toolBrand } from "@/lib/toolbox/brands";
import { ResourceHeader } from "@/components/members/resource-header";
import navigation from "@/components/members/resource-header.module.css";
import memberStyles from "@/components/members/members.module.css";
import { toolboxReturnPath } from "@/lib/billing/community-navigation";
import { memberToolbox } from "@/lib/toolbox/store";
import { isGitHubRepository, isRepositoryCategory, repositoryModes, repositoryPrompt, repositorySetup } from "@/lib/toolbox/repositories.mjs";
import { RepositoryPrompt } from "./repository-prompt";
import { RepositoryPreview } from "./repository-preview";
import styles from "./toolbox.module.css";

export const metadata: Metadata = { title: "Caixa de ferramentas | Apogee", robots: { index: false, follow: false } };
const toolboxPath = "/membros/ferramentas";
const skillsCategory = "skills";
const skillsPath = toolboxReturnPath(skillsCategory);
const appsPath = toolboxReturnPath(null, "aplicativos");
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default async function MemberToolboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selected = typeof params.categoria === "string" && params.categoria ? params.categoria : null;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const section = params.secao === "github" || params.secao === "aplicativos" ? params.secao : undefined;
  const repositories = section ? section === "github" : !selected || isRepositoryCategory(selected);
  const skills = !section && selected === skillsCategory;
  const { member, access, categories, tools } = await memberToolbox(selected, section);
  const groups = categories.filter(category => repositories ? isRepositoryCategory(category.slug)
    : !isRepositoryCategory(category.slug) && skills === (category.slug === skillsCategory));
  if (access.allowed && selected && !skills && !groups.some(category => category.slug === selected)) notFound();

  const mode = repositories && typeof params.modo === "string" && repositoryModes.includes(params.modo) ? params.modo : "";
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const matches = tools.filter(tool => {
    if (repositories) {
      if (!isRepositoryCategory(tool.categorySlug) || !isGitHubRepository(tool.url)) return false;
      if (mode && repositorySetup(tool.conditions).mode !== mode) return false;
    } else if (isRepositoryCategory(tool.categorySlug) || skills !== (tool.categorySlug === skillsCategory)) return false;
    const repositoryKeywords = repositories ? tool.conditions : "";
    const text = searchText([tool.name, tool.description, tool.categoryName, new URL(tool.url).hostname, repositoryKeywords].join(" "));
    return terms.every(term => text.includes(term));
  });
  const noun = repositories ? "projeto" : skills ? "skill" : "aplicativo";
  const sectionPath = repositories ? toolboxPath : skills ? skillsPath : appsPath;
  const filtered = Boolean(query || mode || (selected && !skills));

  return <MemberWorkspace member={member} current="ferramentas"><div data-ap-toolbox="" className={`${memberStyles.container} ${styles.catalogue}`}>
    <ResourceHeader area="ferramentas" />
    {!access.allowed ? <LockedMemberArea kind="ferramentas" next={toolboxReturnPath(selected, section)} /> : <>
      <nav className={navigation.tabs} aria-label="Seções da Caixa de ferramentas">
        <Link href={toolboxPath} aria-current={repositories ? "page" : undefined}>Super Poder para sua IA</Link>
        <Link href={skillsPath} aria-current={skills ? "page" : undefined}>Skills</Link>
        <Link href={appsPath} aria-current={!skills && !repositories ? "page" : undefined}>Aplicativos</Link>
      </nav>
      {repositories && <section className={styles.repositoryHero} aria-labelledby="repository-intro">
        <Sparkles size={24} aria-hidden="true" />
        <div>
          <h2 id="repository-intro">Escolha um projeto. Sua IA te ajuda a começar.</h2>
          <p>Encontre o que você quer fazer e leve o projeto para a IA que já usa, com um prompt pronto para copiar.</p>
        </div>
      </section>}
      {groups.length > 0 && <form action={toolboxPath} method="get" role="search" aria-label={`Buscar ${noun}s`} className={navigation.filters}>
        <label>Buscar {noun}<span className={navigation.searchInput}><Search size={17} aria-hidden="true" /><input type="search" name="q" defaultValue={query} placeholder={repositories ? "Ex.: legendar vídeo ou ler PDF" : "Nome ou tarefa"} maxLength={100} /></span></label>
        {!skills && <input type="hidden" name="secao" value={repositories ? "github" : "aplicativos"} />}
        {skills ? <input type="hidden" name="categoria" value={skillsCategory} /> : <label>{repositories ? "O que você quer fazer?" : "Categoria"}<select name="categoria" defaultValue={selected ?? ""}>
          <option value="">{repositories ? "Todas as tarefas" : "Todas as categorias"}</option>{groups.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
        </select></label>}
        {repositories && <label>Como usar<select name="modo" defaultValue={mode}>
          <option value="">Qualquer opção</option>
          {repositoryModes.map(value => <option key={value} value={value}>{value}</option>)}
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
            <div className={styles.groupHead}><h2 data-ap-heading="" id={`category-${c.slug}`}>{c.name}</h2>{c.description && <p>{c.description}</p>}</div>
            <ul className={styles.tools}>{items.map(t => {
              if (repositories) {
                const { mode, details } = repositorySetup(t.conditions);
                return <li data-ap-card="" className={`${styles.tool} ${styles.repository}`} key={t.id}>
                  <div>
                    {mode && <p className={styles.mode}>{mode}</p>}
                    <h3 data-ap-heading="">{t.name}</h3>
                    <p className={styles.description}>{t.description}</p>
                    <RepositoryPreview project={t} />
                    <details className={styles.setup}>
                      <summary>Como começar<span className="sr-only"> com {t.name}</span></summary>
                      <p>Abra sua IA. Clique em <strong>Usar na minha IA</strong>, logo abaixo, e depois em <strong>Copiar prompt</strong>. Cole o texto na conversa com a sua IA.</p>
                      {details && <p>{details}</p>}
                    </details>
                  </div>
                  <div className={styles.repositoryActions}>
                    <RepositoryPrompt name={t.name} prompt={repositoryPrompt(t)} />
                    <a data-ap-button="secondary" href={t.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                      Abrir no GitHub <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> {t.name} (abre em nova aba)</span>
                    </a>
                  </div>
                </li>;
              }
              const domain = productDomain(t.url);
              return <li data-ap-card="" className={styles.tool} key={t.id}>
              <div><p className={styles.domain}>{new URL(t.url).hostname.replace(/^www\./, "")}</p><h3 data-ap-heading=""><ProductMark name={t.name} brand={skills ? undefined : toolBrand(t.name, t.url)} fallbackSrc={domain ? `/api/marcas?site=${encodeURIComponent(domain)}` : undefined} />{t.name}</h3><p className={styles.description}>{t.description}</p>{t.conditions && <p className={styles.conditions}>{t.conditions}</p>}</div>
              <a data-ap-button="primary" className={styles.open} href={t.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                {skills ? "Abrir skill" : "Abrir aplicativo"}<span className="sr-only"> {t.name} (abre em nova aba)</span>
              </a>
            </li>;
            })}</ul>
          </section>;
        })}</div>
        <p className={styles.footer}>Os links abrem em uma nova aba. Planos e créditos seguem as condições de cada fornecedor.</p>
      </> : <section className={styles.empty}>
        <h2 data-ap-heading="">{filtered ? "Nenhum resultado para esses filtros" : repositories ? "Projetos em preparação" : skills ? "Skills em preparação" : "Aplicativos em preparação"}</h2>
        {filtered && <p>Tente outro termo ou escolha outra tarefa.</p>}
        <Link href={filtered ? sectionPath : skills || repositories ? appsPath : "/membros"}>{filtered ? "Limpar filtros" : skills || repositories ? "Explorar aplicativos" : "Voltar para a comunidade"}</Link>
      </section>}
    </>}
  </div></MemberWorkspace>;
}
