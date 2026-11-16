import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNotice, AdminPageHeader } from "@/components/admin/admin-ui";
import { formatDateTime } from "@/components/members/format";
import { adminToolbox } from "@/lib/toolbox/store";
import { TOOLBOX_STATUS_LABELS } from "@/lib/toolbox/types";
import { ToolboxCategoryForm, ToolboxToolForm } from "./forms";
import styles from "./toolbox-admin.module.css";

export const metadata: Metadata = { title: "Caixa de ferramentas" };
export default async function ToolboxAdminPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const { categories, tools } = await adminToolbox();
  const query = await searchParams;
  const category = typeof query.categoria === "string" ? categories.find(c => c.id === query.categoria) : undefined;
  const tool = typeof query.ferramenta === "string" ? tools.find(t => t.id === query.ferramenta) : undefined;
  if ((typeof query.categoria === "string" && !category) || (typeof query.ferramenta === "string" && !tool)) notFound();
  return <>
    <AdminPageHeader title="Caixa de ferramentas" description="Organize categorias e links oficiais para os assinantes anuais." aside={<Link href="/membros/ferramentas">Pré-visualizar como membro</Link>} />
    {query.salvo === "categoria" || query.salvo === "ferramenta" ? <AdminNotice tone="success" title={query.salvo === "categoria" ? "Categoria salva" : "Ferramenta salva"} description="A alteração já aparece abaixo. A visibilidade para o membro segue o estado da categoria e da ferramenta." /> : null}
    <div className={styles.editors}>
      <ToolboxCategoryForm key={`category:${category?.id ?? 'new'}:${category?.version ?? 0}`} item={category} />
      <ToolboxToolForm key={`tool:${tool?.id ?? 'new'}:${tool?.version ?? 0}`} item={tool} categories={categories.map(c => ({ id:c.id,name:c.name,status:c.status }))} />
    </div>
    <section aria-labelledby="categories-title"><h2 id="categories-title">Categorias · {categories.length}</h2>
      {!categories.length ? <p>Comece criando a categoria da primeira ferramenta.</p> : <ul className={styles.list}>{categories.map(c => <li className={styles.row} key={c.id}>
        <div><h3>{c.name}</h3><p>{c.description ?? "Sem descrição adicional."}</p><p>Ordem {c.order} · {tools.filter(t => t.categoryId === c.id).length} ferramenta(s)</p></div>
        <span className={styles.state} data-status={c.status}>{TOOLBOX_STATUS_LABELS[c.status]}</span><Link href={`/admin/ferramentas?categoria=${c.id}#editor-categoria`}>Editar categoria<span className="sr-only"> {c.name}</span></Link>
      </li>)}</ul>}
    </section>
    <section aria-labelledby="tools-title"><h2 id="tools-title">Ferramentas · {tools.length}</h2>
      {!tools.length ? <p>Cadastre um link oficial e confira a ficha antes de publicar.</p> : <ul className={styles.list}>{tools.map(t => <li className={styles.row} key={t.id}>
        <div><h3>{t.name}</h3><p>{categories.find(c => c.id === t.categoryId)?.name} · Ordem {t.order}</p><p>{t.url}</p>
          <p>{t.reviewedAt ? `Conferência: ${formatDateTime(t.reviewedAt)}${t.reviewedByName ? ` · ${t.reviewedByName}` : ''}` : "Conferência ainda não registrada."}</p>
        </div>
        <span className={styles.state} data-status={t.status}>{TOOLBOX_STATUS_LABELS[t.status]}</span><Link href={`/admin/ferramentas?ferramenta=${t.id}#editor-ferramenta`}>Editar ferramenta<span className="sr-only"> {t.name}</span></Link>
      </li>)}</ul>}
    </section>
  </>;
}
