"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
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
  return <Link className={className} href={account?.communityActive ? "/membros" : offerHref} prefetch={false}>
    {account?.communityActive ? "Acessar comunidade" : label}
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
    <summary><UserRound size={18} aria-hidden="true" /><span>Minha conta</span></summary>
    <div className={styles.panel}>
      <p className={styles.identity}>{account.name}<span>@{account.username}</span></p>
      <nav aria-label="Minha conta">
        <Link href="/membros">Minha comunidade</Link>
        <Link href="/membros/perfil/editar">Meu perfil</Link>
        <Link href="/membros/assinatura">Assinatura e acesso</Link>
        <Link href="/membros/protecao">Verificação da conta</Link>
        <Link href="/membros/suporte">Ajuda e suporte</Link>
        {account.role === "admin" ? <Link href="/admin">Administração</Link> : null}
      </nav>
      <form action={signOut}><SignOutButton /></form>
    </div>
  </details>;
}
