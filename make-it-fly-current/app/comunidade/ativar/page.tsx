import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/members/dal";
import { ANNUAL_ACTIVATION_PATH } from "@/lib/billing/community-guest-store";
import { EditorialPageShell } from "@/components/site/editorial-page-shell";
import { ApogeeInterface } from "@/components/site/apogee-design-system";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ative sua assinatura | Apogee", robots: { index: false, follow: false } };
export default async function ActivatePurchasePage() {
  if (await getCurrentMember()) redirect(ANNUAL_ACTIVATION_PATH);
  const next = encodeURIComponent(ANNUAL_ACTIVATION_PATH);
  return <ApogeeInterface editorial><EditorialPageShell current="community"><main className={styles.narrow}>
    <h1 className={styles.title}>Agora, crie seu acesso.</h1>
    <p className={styles.lead}>Use o mesmo e-mail informado no checkout. Após confirmar esse e-mail, vinculamos a compra à sua conta.</p>
    <div className={styles.form}>
      <Link data-ap-button="primary" href={`/membros/cadastro?next=${next}`}>Criar minha conta</Link>
      <Link data-ap-button="secondary" href={`/membros/entrar?next=${next}`}>Já tenho conta</Link>
    </div>
    <p className={styles.hint}>A assinatura é liberada após a confirmação do pagamento. Algumas áreas também exigem a verificação da conta.</p>
    <p><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </main></EditorialPageShell></ApogeeInterface>;
}
