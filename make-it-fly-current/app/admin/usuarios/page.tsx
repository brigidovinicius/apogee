import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { listAdminUsers, type AdminUserFilter } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function roleFilter(value: string | undefined): AdminUserFilter {
  return value === "member" || value === "admin" ? value : "all";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; papel?: string }>;
}) {
  const params = await searchParams;
  const search = params.busca ?? "";
  const filter = roleFilter(params.papel);
  const result = await listAdminUsers(search, filter);

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Usuários"
        description="Consulta administrativa mínima das contas. Dados privados de candidatura, documentos, notas, tokens e senhas não fazem parte desta superfície."
        aside={<span className={styles.dataBadge}>{result.total} {result.total === 1 ? "conta" : "contas"}</span>}
      />

      <form className={styles.filters} method="get" role="search">
        <label className={styles.field}>
          <span>Buscar por nome, usuário ou e-mail</span>
          <input name="busca" type="search" defaultValue={search.slice(0, 80)} maxLength={80} />
        </label>
        <label className={styles.field}>
          <span>Papel</span>
          <select name="papel" defaultValue={filter}>
            <option value="all">Todos</option>
            <option value="member">Membros</option>
            <option value="admin">Administradores</option>
          </select>
        </label>
        <button className={styles.button} type="submit">Aplicar filtros</button>
      </form>

      {result.users.length > 0 ? (
        <section aria-labelledby="users-result-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Resultado</p>
              <h2 id="users-result-title">Contas encontradas</h2>
              {result.limited ? <p>Mostrando as 50 contas mais recentes deste filtro.</p> : null}
            </div>
          </div>
          <ul className={styles.userList}>
            {result.users.map((account) => (
              <li key={account.id}>
                <details className={styles.userListItem}>
                  <summary>
                    <span className={styles.avatar} aria-hidden>{initials(account.name)}</span>
                    <span className={styles.userIdentity}>
                      <strong>{account.name}</strong>
                      <span>{account.username ? `@${account.username}` : "Sem nome de usuário"}</span>
                    </span>
                    <span className={styles.roleBadge}>{account.role === "admin" ? "Administrador" : "Membro"}</span>
                    <span className={styles.verifiedState}>{account.emailVerified ? "E-mail verificado" : "E-mail não verificado"}</span>
                    <time dateTime={account.createdAt.toISOString()}>{dateTime.format(account.createdAt)}</time>
                  </summary>
                  <dl className={styles.userDetails}>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{account.email}</dd>
                    </div>
                    <div>
                      <dt>Papel atual</dt>
                      <dd>{account.role === "admin" ? "Administrador" : "Membro"}</dd>
                    </div>
                    <div>
                      <dt>Conta criada</dt>
                      <dd>{dateTime.format(account.createdAt)}</dd>
                    </div>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.emptyState} role="status">
          <div className={styles.stateCard}>
            <p className={styles.eyebrow}>Nenhum resultado</p>
            <h2>Não há contas com estes filtros.</h2>
            <p>Revise a busca ou selecione outro papel. Nenhum dado foi alterado.</p>
          </div>
        </section>
      )}
    </div>
  );
}
