import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/members/auth-forms";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";
import { isAnnualPurchasePath } from "@/lib/billing/community-navigation";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; senha?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const annual = isAnnualPurchasePath(next);
  const activation = next.split(/[?#]/, 1)[0] === "/membros/ativar-assinatura";
  if (await getCurrentMember()) redirect(next);

  return (
    <div className={styles.narrow}>
      <header className={styles.authIntro}>
        <p className={styles.eyebrow}>{annual ? "Comunidade Apogee · Plano anual" : "Área de membros"}</p>
        <h1 className={styles.title}>{activation ? "Entre para ativar a assinatura" : annual ? "Entre para continuar a assinatura" : "Entrar"}</h1>
        <p className={styles.lead}>{activation ? "Use o mesmo e-mail informado no checkout. Sua compra será vinculada após a confirmação desse e-mail." : annual ? "R$ 1.438,80 por ano, com renovação automática. Você revisa o total antes de pagar." : "Acesse o fórum, seu perfil e o Radar de oportunidades da comunidade Apogee"}</p>
      </header>
      <div className={`${styles.panel} ${styles.authPanel}`}>
        {params.senha === "redefinida" && <p role="status">Senha redefinida. Entre com sua nova senha.</p>}
        <SignInForm next={next} googleError={googleOAuthErrorMessage(params.error)} />
      </div>
      <p className={styles.switchAuth}>
        Ainda não tem conta? <Link href={`/membros/cadastro?next=${encodeURIComponent(next)}`}>Criar conta</Link>
      </p>
      <p className={styles.switchAuth}><Link href="/membros/suporte">Preciso de ajuda para entrar</Link></p>
    </div>
  );
}
