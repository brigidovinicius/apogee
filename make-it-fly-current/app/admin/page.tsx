import Link from "next/link";
import { AdminNotice, AdminPageHeader, MetricCard, adminStyles as styles } from "@/components/admin/admin-ui";
import { getAdminOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("pt-BR");
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Painel"
        description="Uma visão operacional do que já existe no produto. As métricas abaixo vêm do banco de membros; módulos ainda sem contrato aparecem separados como pendências."
        aside={<span className={styles.dataBadge}>Dados atuais do servidor</span>}
      />

      <section className={styles.metrics} aria-label="Indicadores atuais">
        <MetricCard label="Contas" value={number.format(overview.accounts)} detail="Registros de usuário existentes" />
        <MetricCard label="Novas em 30 dias" value={number.format(overview.newAccounts30Days)} detail="Criadas no período móvel" />
        <MetricCard label="Administradores" value={number.format(overview.admins)} detail="Papel administrativo atual" />
        <MetricCard label="Membros" value={number.format(overview.members)} detail="Papel padrão de membro" />
        <MetricCard label="Tópicos do fórum" value={number.format(overview.topics)} detail="Discussões criadas" />
        <MetricCard label="Mensagens do fórum" value={number.format(overview.posts)} detail="Aberturas e respostas" />
      </section>

      <div className={styles.twoColumns}>
        <section className={styles.surface} aria-labelledby="attention-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Exceções primeiro</p>
              <h2 id="attention-title">Precisa de definição</h2>
              <p>Itens visíveis no protótipo que ainda não têm domínio persistido ou regra aprovada.</p>
            </div>
          </div>
          <div className={styles.noticeList}>
            <AdminNotice
              tone="attention"
              title="Fila de curadoria sem contrato de revisão"
              description="O catálogo atual pode ser auditado, mas publicar, rejeitar e comparar evidências ainda não são ações disponíveis."
              action={<Link href="/admin/curadoria">Ver catálogo</Link>}
            />
            <AdminNotice
              tone="attention"
              title="Editor de posts sem CMS"
              description="Não há schema, armazenamento editorial, revisão, slug ou política de publicação configurados."
              action={<Link href="/admin/posts/novo">Ver limites</Link>}
            />
            <AdminNotice
              title="Galeria mantém acesso administrativo separado"
              description="A operação do Make It Fly continua protegida pela credencial própria existente; o papel admin não amplia esse acesso."
              action={<Link href="/gerenciar-galeria">Abrir rota separada</Link>}
            />
          </div>
        </section>

        <section className={styles.surface} aria-labelledby="recent-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Pessoas</p>
              <h2 id="recent-title">Cadastros recentes</h2>
              <p>Sem candidaturas, notas privadas ou credenciais.</p>
            </div>
            <Link className={styles.textLink} href="/admin/usuarios">Ver usuários</Link>
          </div>
          {overview.recentAccounts.length > 0 ? (
            <ul className={styles.accountList}>
              {overview.recentAccounts.map((account) => (
                <li key={account.id}>
                  <span className={styles.avatar} aria-hidden>{initials(account.name)}</span>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{account.username ? `@${account.username}` : "Sem nome de usuário"} · {account.role === "admin" ? "Administrador" : "Membro"}</span>
                  </div>
                  <time dateTime={account.createdAt.toISOString()}>{dateTime.format(account.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">Nenhum cadastro disponível.</p>
          )}
        </section>
      </div>
    </div>
  );
}
