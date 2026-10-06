import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { OpportunityPreview } from "@/lib/opportunities/types";
import styles from "./opportunities.module.css";

type OpportunitiesPreviewProps = {
  opportunities: readonly OpportunityPreview[];
};

const memberNext = encodeURIComponent("/membros/oportunidades");

export function OpportunitiesPreview({ opportunities }: OpportunitiesPreviewProps) {
  return (
    <section className={styles.board} aria-labelledby="mural-title">
      <div className={styles.boardHeading}>
        <div>
          <p className={styles.kicker}>Prévia pública</p>
          <h2 id="mural-title">Veja o que está no radar.</h2>
        </div>
        <p className={styles.count}>Detalhes disponíveis na área de membros</p>
      </div>

      <div className={styles.previewCta}>
        <div>
          <LockKeyhole size={18} aria-hidden />
          <p>Cadastre-se para ver critérios, apoio, prazos e links oficiais de cada oportunidade.</p>
        </div>
        <div className={styles.previewActions}>
          <Link className={styles.previewPrimary} href={`/membros/cadastro?next=${memberNext}`}>
            Criar conta
          </Link>
          <Link className={styles.previewLogin} href={`/membros/entrar?next=${memberNext}`}>
            Entrar
          </Link>
        </div>
      </div>

      {opportunities.length > 0 ? (
        <div className={styles.grid}>
          {opportunities.map((opportunity) => (
            <article className={`${styles.card} ${styles.previewCard}`} key={opportunity.id}>
              <div className={styles.cardTopline}>
                <span className={styles.kind}>{opportunity.kind}</span>
                <span>{opportunity.level}</span>
              </div>
              <div className={styles.cardMain}>
                <p className={styles.organization}>{opportunity.organization}</p>
                <h3>{opportunity.title}</h3>
              </div>
              <div className={styles.previewDetails} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className={styles.srOnly}>
                Os detalhes desta oportunidade ficam disponíveis somente para membros autenticados.
              </p>
              <Link className={styles.previewCardLink} href={`/membros/cadastro?next=${memberNext}`}>
                Desbloquear detalhes <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <h3>Novas oportunidades serão exibidas em breve.</h3>
          <p>Crie sua conta para acessar o Radar completo assim que ele for atualizado.</p>
        </div>
      )}
    </section>
  );
}
