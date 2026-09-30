import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/members/auth-forms";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  if (await getCurrentMember()) redirect("/membros");

  return (
    <div className={styles.narrow}>
      <p className={styles.eyebrow}>Área de membros</p>
      <h1 className={styles.title}>Criar conta</h1>
      <p className={styles.lead}>Entre para a comunidade e participe do fórum.</p>
      <div className={styles.panel} style={{ marginTop: "2rem" }}>
        <SignUpForm />
      </div>
      <p className={styles.switchAuth}>
        Já tem conta? <Link href="/membros/entrar">Entrar</Link>
      </p>
    </div>
  );
}
