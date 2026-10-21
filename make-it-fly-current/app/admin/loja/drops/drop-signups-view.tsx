import Link from "next/link";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import type { DropSignupList } from "@/lib/admin/drop-signups";
import { DropExportButton } from "./export-button";
import styles from "./drops.module.css";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function DropSignupsView({ result }: { result: DropSignupList }) {
  const { rows, search, total, page, pageCount, pageSize } = result;
  const pageHref = (number: number) => `/admin/loja/drops?${new URLSearchParams({ busca: search, pagina: String(number) })}`;
  return (
    <div className={`${adminStyles.content} ${styles.content}`}>
      <AdminPageHeader eyebrow="Loja Apogee" title="Cadastros dos drops"
        description="Contatos que autorizaram receber novidades dos próximos lançamentos."
        aside={<span className={adminStyles.dataBadge}>{total} {total === 1 ? "cadastro" : "cadastros"}</span>} />
      <form className={styles.search} action="/admin/loja/drops" method="get" role="search">
        <label className={adminStyles.field} htmlFor="drop-search"><span>Buscar por nome, telefone ou e-mail</span>
          <input id="drop-search" name="busca" type="search" defaultValue={search} maxLength={120} />
        </label>
        <button className={adminStyles.button} type="submit">Buscar</button>
        {search ? <Link className={adminStyles.secondaryButton} href="/admin/loja/drops">Limpar busca</Link> : null}
      </form>
      <div className={styles.toolbar}>
        <p>{search ? <>Resultados para <strong>{search}</strong>.</> : "Cadastros mais recentes primeiro."} Datas no horário de Brasília.</p>
        <DropExportButton search={search} disabled={total === 0} />
      </div>
      {rows.length ? <>
        <div className={styles.tableRegion} role="region" aria-label="Lista dos cadastros dos drops" tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.caption}>Nome, contato e data de cadastro</caption>
            <thead><tr><th scope="col">Nome</th><th scope="col">Telefone</th><th scope="col">E-mail</th><th scope="col">Data do cadastro</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <th scope="row">{row.name}</th><td>{row.phone}</td><td>{row.email}</td>
              <td><time dateTime={row.consentedAt.toISOString()}>{dateTime.format(row.consentedAt)}</time></td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className={styles.pagination} aria-label="Páginas dos cadastros">
          <p>{(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} cadastros · Página {page} de {pageCount}</p>
          <div>{page > 1 ? <Link className={adminStyles.secondaryButton} href={pageHref(page - 1)}>Anterior</Link> : null}
            {page < pageCount ? <Link className={adminStyles.secondaryButton} href={pageHref(page + 1)}>Próxima</Link> : null}</div>
        </nav>
      </> : <section className={adminStyles.emptyState} role="status"><div className={adminStyles.stateCard}>
        <h2>{search ? "Nenhum cadastro encontrado." : "Os próximos cadastros aparecerão aqui."}</h2>
        <p>{search ? "Tente outro nome, telefone ou e-mail, ou limpe a busca." : "Os contatos enviados pelo formulário da loja serão listados automaticamente."}</p>
      </div></section>}
    </div>
  );
}
