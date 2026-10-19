import type {Metadata} from "next";
import Link from "next/link";
import {AlertTokenForm} from "@/components/opportunities/alert-token-form";
import {SiteHeader} from "@/components/site/site-header";
import {SiteFooter} from "@/components/site/site-footer";
import styles from "@/components/opportunities/opportunities.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Acompanhamento de oportunidade | Apogee",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function AlertPage({searchParams}:{searchParams:Promise<{token?:string;acao?:string}>}) {
  const {token,acao}=await searchParams;
  const valid=typeof token==="string" && /^[a-f0-9]{64}$/.test(token) && ["confirmar","cancelar"].includes(acao ?? "");
  return <><SiteHeader current="opportunities" /><main id="experiencia" tabIndex={-1} className={`${styles.main} ${styles.noticePage}`}><h1>Acompanhamento de oportunidade</h1>
    {valid?<><p>{acao==="confirmar"?"Confirme para receber avisos quando houver mudanças nesta oportunidade.":"Cancele para deixar de receber os avisos desta oportunidade."}</p><AlertTokenForm token={token!} action={acao==="confirmar"?"confirm":"unsubscribe"}/></>:<p>Link inválido. Use o link enviado ao seu e-mail.</p>}
    <p><Link href="/oportunidades">Voltar ao Radar</Link></p>
  </main><SiteFooter /></>;
}
