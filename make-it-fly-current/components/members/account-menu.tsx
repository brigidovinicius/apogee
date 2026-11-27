"use client";

import { AreaIcon } from "@/components/site/area-icon";
import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/membros/actions";
import styles from "./account-menu.module.css";

export type AccountIdentity = { name: string; username: string; role: "member" | "admin" };
const AccountContext = createContext<AccountIdentity | null>(null);

export function CommunityEntryLink({ className, href = "/membros/entrar", label = "Entrar" }: {
  className?: string; href?: string; label?: string;
}) {
  const account = useContext(AccountContext);
  return <Link data-ap-button="primary" className={className} href={account ? "/membros" : href} prefetch={false}>
    <AreaIcon area={account ? "comunidade" : "perfil"} />{account ? "Minha comunidade" : label}
  </Link>;
}

export function MemberBrandLink({ className, children }: { className?: string; children: ReactNode }) {
  const account = useContext(AccountContext);
  return <Link className={className} href={account ? "/membros" : "/"} aria-label={account ? "Início da área de membros" : "Apogee - início"}>
    {children}
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

function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className={styles.signOut} type="submit" disabled={pending} aria-label="Sair da conta">
    <LogOut size={17} aria-hidden="true" />{pending ? "Saindo…" : "Sair da conta"}
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
    document.addEventListener("click", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("click", dismiss);
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
    <summary><AreaIcon area="perfil" /><span>Minha conta</span><ChevronDown className={styles.chevron} size={14} aria-hidden="true" /></summary>
    <div className={styles.panel}>
      <p className={styles.identity}>{account.name}<span>@{account.username}</span></p>
      <nav aria-label="Minha conta">
        <Link href={account.username ? `/membros/perfil/${encodeURIComponent(account.username)}` : "/membros/perfil/configurar"}><AreaIcon area="perfil" />Meu perfil</Link>
        <Link href="/membros/assinatura"><AreaIcon area="assinatura" />Assinatura e acesso</Link>
        <Link href="/membros/suporte"><AreaIcon area="suporte" />Ajuda e suporte</Link>
        {account.role === "admin" ? <Link href="/admin"><AreaIcon area="protecao" />Administração</Link> : null}
        <Link href="/"><AreaIcon area="home" />Voltar ao site</Link>
      </nav>
      <form action={signOut}><SignOutButton /></form>
    </div>
  </details>;
}
