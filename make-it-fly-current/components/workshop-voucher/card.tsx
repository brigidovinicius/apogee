import Link from "next/link";
import { PartnerMark } from "@/components/benefits/partner-mark";
import { VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import styles from "@/components/benefits/benefits.module.css";

const partner = "OpenAI";

// Mirrors BenefitCard. The voucher is not a member_benefit row, so it has no save button.
export function WorkshopVoucherCard() {
  if (!voucherConfigured()) return null;
  return (
    <article data-ap-card="" className={`${styles.card} ${styles.offerCard}`}>
      <div className={styles.offerTop}>
        <div className={styles.brand}>
          <div className={styles.brandMeta}>
            <p>{partner}</p>
            <span className={styles.category}>Evento · Codex Community Workshop</span>
          </div>
        </div>
      </div>

      <div className={styles.offerBody}>
        <h3><PartnerMark partner={partner} offerId="voucher-openai" /><Link href={VOUCHER_PATH} prefetch={false}>Voucher OpenAI</Link></h3>
        <p className={styles.description}>Crédito individual para os primeiros participantes com check-in presencial no workshop.</p>
        <p className={styles.condition}><strong>Quem pode resgatar</strong>Conta Apogee com o mesmo e-mail do ingresso no Luma, ou vinculada pelo código recebido por e-mail.</p>
      </div>

      <div className={styles.offerFooter}>
        <div><span className={styles.validity}>Reserva por ordem de check-in</span></div>
        <Link href={VOUCHER_PATH} prefetch={false} className={styles.offerLink}>Acessar meu voucher</Link>
      </div>
    </article>
  );
}
