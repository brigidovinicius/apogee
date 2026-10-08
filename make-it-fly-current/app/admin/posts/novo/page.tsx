import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminNewPostPage() {
  await requireAdmin("/admin/posts/novo");

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Novo post"
        description="Estrutura visual do editor administrativo. Os campos ficam indisponíveis porque o produto ainda não possui CMS, persistência editorial ou fluxo de publicação aprovado."
        aside={<span className={styles.dataBadge}>Editor não ativado</span>}
      />

      <div className={styles.editorGrid}>
        <section className={styles.editorCanvas} aria-labelledby="editor-title">
          <div>
            <p className={styles.eyebrow}>Rascunho indisponível</p>
            <h2 id="editor-title">Superfície de edição</h2>
          </div>
          <label className={styles.field}>
            <span>Título</span>
            <input disabled placeholder="Defina o modelo editorial antes de criar conteúdo" />
          </label>
          <label className={styles.field}>
            <span>Resumo</span>
            <textarea disabled placeholder="Nenhum conteúdo é salvo por esta tela" />
          </label>
          <button className={styles.button} type="button" disabled>Salvar rascunho</button>
        </section>

        <aside className={styles.inspector} aria-labelledby="contract-title">
          <p className={styles.sectionEyebrow}>Antes de ativar</p>
          <h2 id="contract-title">Contrato editorial pendente</h2>
          <p>O protótipo propõe estes recursos, mas eles não existem no sistema atual:</p>
          <ul className={styles.contractList}>
            <li>schema de post, revisão e autor</li>
            <li>slug, categorias e conteúdo sanitizado</li>
            <li>armazenamento de capa e texto alternativo</li>
            <li>acesso público ou restrito definido no servidor</li>
            <li>metadata, sitemap e agendamento</li>
            <li>auditoria de publicação e arquivamento</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
