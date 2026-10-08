import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { OpportunityPreview } from "@/lib/opportunities/types";
import { PublicOpportunitiesPreview } from "./public-opportunities-preview";
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

      <PublicOpportunitiesPreview opportunities={opportunities} memberNext={memberNext} />
    </section>
  );
}
