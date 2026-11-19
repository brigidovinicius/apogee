import Link from "next/link";
import type { MonthlyDetailQuota } from "@/lib/members/monthly-detail";
import styles from "./community-offer.module.css";

export function MonthlyQuota({ quota, area, next }: { quota: MonthlyDetailQuota; area: "Radar" | "Benefícios"; next: string }) {
  const renewal = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" })
    .format(new Date(`${quota.renewsOn}T00:00:00Z`));
  return <aside className={`${styles.scope} ${styles.intro}`} aria-label={`Consultas mensais · ${area}`}>
    <div><p role="status"><strong>{quota.remaining} de {quota.limit} consultas restantes em {area}.</strong> {quota.remaining === 0 && "Limite mensal atingido. O catálogo e os detalhes já liberados continuam disponíveis. "}
      Renovação em <time dateTime={quota.renewsOn}>{renewal}</time>.</p><p>Reabrir um item no mesmo mês não usa outra consulta.</p></div>
    {quota.remaining === 0 && <Link data-ap-button="secondary" className={styles.secondary} href={`/comunidade?next=${encodeURIComponent(next)}#planos`} prefetch={false}>Conhecer o plano anual</Link>}
  </aside>;
}
