import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Gift } from "lucide-react";
import { BENEFIT_AUDIENCES, PROVIDER_ACCESS_LABELS, type CatalogueBenefit } from "@/lib/benefits/types";
import { BenefitSaveButton } from "./member-forms";
import styles from "./benefits.module.css";

const logosByPartner = new Map([
  ["n8n", "/brand/benefits/n8n.svg"],
  ["teamwork", "/brand/benefits/teamwork.svg"],
  ["teamwork.com", "/brand/benefits/teamwork.svg"],
]);

export function BenefitCard({ benefit, validity, detailSearch = "" }: { benefit: CatalogueBenefit; validity: string; detailSearch?: string }) {
  const logo = logosByPartner.get(benefit.partner.trim().toLowerCase());
  const href = `/membros/beneficios/${encodeURIComponent(benefit.id)}${detailSearch}`;

  return (
    <article id={`oferta-${benefit.id}`} tabIndex={-1} className={`${styles.card} ${styles.offerCard}`}>
      <div className={styles.offerTop}>
        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true">
            {logo ? <Image src={logo} width={32} height={32} alt="" unoptimized /> : <Gift size={23} />}
          </div>
          <div className={styles.brandMeta}>
            <p>{benefit.partner}</p>
            <span className={styles.category}>{benefit.category_name ?? "Geral"} · {BENEFIT_AUDIENCES[benefit.audience]}</span>
          </div>
        </div>
        <BenefitSaveButton benefitId={benefit.id} name={benefit.name} saved={benefit.saved} />
      </div>

      <div className={styles.offerBody}>
        <h3><Link href={href}>{benefit.name}</Link></h3>
        {benefit.description !== benefit.name && <p className={styles.description}>{benefit.description}</p>}
        {benefit.eligibility && <p className={styles.condition}><strong>Quem pode resgatar</strong>{benefit.eligibility}</p>}
        {benefit.provider_access !== "unconfirmed" && <p className={styles.access}>{PROVIDER_ACCESS_LABELS[benefit.provider_access]}</p>}
      </div>

      <div className={styles.offerFooter}>
        <div>
          <span className={styles.validity}><CalendarDays size={15} aria-hidden="true" />{validity}</span>
          {benefit.provider_label && <span className={styles.provider}>{benefit.provider_label}</span>}
        </div>
        <Link href={href} className={styles.offerLink} aria-label={`Ver condições da oferta: ${benefit.name}`}>
          Ver condições <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
