import Link from "next/link";
import { VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import styles from "@/components/benefits/benefits.module.css";

export function WorkshopVoucherCard() {
  if (!voucherConfigured()) return null;
  return <article data-ap-card="" className={styles.card}>
    <p className={styles.partner}>Codex Community Workshop · Florianópolis</p>
    <h2>Voucher OpenAI</h2>
    <p>Consulte a sua reserva para os primeiros participantes com check-in presencial.</p>
    <Link href={VOUCHER_PATH} prefetch={false} data-ap-button="secondary">Acessar meu voucher</Link>
  </article>;
}
