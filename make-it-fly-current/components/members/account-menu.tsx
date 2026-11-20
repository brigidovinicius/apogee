"use client";

import { AreaIcon } from "@/components/site/area-icon";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/membros/actions";
import { COMMUNITY_PLANS_PATH } from "@/content/community-offer";
import styles from "./account-menu.module.css";

export type AccountIdentity = { name: string; username: string; role: "member" | "admin"; communityActive?: boolean };
const AccountContext = createContext<AccountIdentity | null>(null);

export function CommunityEntryLink({ className, offerHref = COMMUNITY_PLANS_PATH, label = "Entrar" }: {
  className?: string; offerHref?: string; label?: string;
}) {
  const account = useContext(AccountContext);
  return <Link data-ap-button="primary" className={className} href={account?.communityActive ? "/membros" : offerHref} prefetch={false}>
    <AreaIcon area={account?.communityActive ? "comunidade" : "perfil"} />{account?.communityActive ? "Acessar comunidade" : label}
  </Link>;
}

export function AccountProvider({ account, children }: { account: AccountIdentity | null; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    // Notify other Apogee tabs without putting identity or tokens in storage.
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel("apogee-account"); } catch { return; }
    channel.onmessage = () => router.refresh();
    channel.postMessage("account-changed");
    return () => channel.close();
  }, [account?.username, account?.role, router]);
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={styles.signOut} type="submit" disabled={pending} aria-label="Sair da conta">
    <LogOut size={17} aria-hidden="true" />{pending ? "Saindo…" : compact ? "Sair" : "Sair da conta"}
  </button>;
}

export function AccountMenu({ fallback }: { fallback: ReactNode }) {
  const account = useContext(AccountContext);
  const details = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && details.current && !details.current.contains(event.target)) details.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, []);
  if (!account) {
    if (pathname === "/membros/entrar" || pathname === "/membros/cadastro") return null;
    return fallback;
  }
  return <details className={styles.menu} data-account-menu ref={details} onKeyDown={event => {
    if (event.key === "Escape" && details.current?.open) {
      event.preventDefault();
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
    }
  }}>
    <summary><AreaIcon area="perfil" /><span>Minha conta</span></summary>
    <div className={styles.panel}>
      <p className={styles.identity}>{account.name}<span>@{account.username}</span></p>
      <nav aria-label="Minha conta">
        <Link href="/membros"><AreaIcon area="home" />Minha comunidade</Link>
        <Link href="/membros/perfil/editar"><AreaIcon area="perfil" />Meu perfil</Link>
        <Link href="/membros/assinatura"><AreaIcon area="assinatura" />Assinatura e acesso</Link>
        <Link href="/membros/protecao"><AreaIcon area="protecao" />Verificação da conta</Link>
        <Link href="/membros/suporte"><AreaIcon area="suporte" />Ajuda e suporte</Link>
        {account.role === "admin" ? <Link href="/admin"><AreaIcon area="protecao" />Administração</Link> : null}
      </nav>
      <form action={signOut}><SignOutButton /></form>
    </div>
  </details>;
}
