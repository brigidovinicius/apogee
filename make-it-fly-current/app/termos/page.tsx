import Link from "next/link";
import {notFound} from "next/navigation";
import {privacyIdentity} from "@/lib/privacy-policy";
import {termsSections,termsOfUseReady} from "@/lib/terms-of-use";
import styles from "@/app/privacidade/privacy.module.css";

export const dynamic='force-dynamic';
export function generateMetadata() {
  return {title:'Termos de Uso | Apogee',description:'Condições de acesso e uso dos serviços Apogee.',
    alternates:{canonical:'/termos'},robots:{index:termsOfUseReady()&&process.env.APOGEE_LOCAL_PREVIEW!=='1',follow:true}};
}
export default function TermsPage() {
  const ready=termsOfUseReady();
  if(!ready&&process.env.APOGEE_LOCAL_PREVIEW!=='1')notFound();
  return <main id="experiencia" className={styles.page}>
    <Link href="/">Apogee · Voltar ao início</Link>
    <header><p>Condições de uso</p><h1>Termos de Uso</h1><p>Versão de 30 de outubro de 2026</p></header>
    {!ready&&<aside className={styles.draft} role="note"><strong>Minuta para revisão</strong><p>Texto preparado para avaliação. Ainda depende de revisão das condições comerciais, dos procedimentos de atendimento e da aprovação do responsável. Esta visualização local não constitui aceite nem altera contratos existentes.</p></aside>}
    <section aria-labelledby="responsavel"><h2 id="responsavel">Quem oferece o serviço</h2><p>{privacyIdentity.name}, CNPJ {privacyIdentity.document}, {privacyIdentity.location}.</p><p>Contato: <a href={`mailto:${privacyIdentity.email}`}>{privacyIdentity.email}</a>.</p><p><Link href="/privacidade">Política de Privacidade</Link></p></section>
    <nav aria-label="Nestes termos"><ul>{termsSections.map(section=><li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul></nav>
    {termsSections.map(section=><section key={section.id} aria-labelledby={section.id}><h2 id={section.id}>{section.title}</h2>{section.paragraphs.map(text=><p key={text}>{text}</p>)}</section>)}
  </main>;
}
