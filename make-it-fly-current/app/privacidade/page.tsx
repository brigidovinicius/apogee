import Link from "next/link";
import {notFound} from "next/navigation";
import {privacyIdentity,privacyPolicyReady,privacySections} from "@/lib/privacy-policy";
import styles from "./privacy.module.css";

export const dynamic="force-dynamic";
export function generateMetadata() {
  return {title:"Política de Privacidade | Apogee",description:"Como a Apogee trata dados pessoais e como exercer seus direitos de privacidade.",
    alternates:{canonical:"/privacidade"},robots:{index:privacyPolicyReady()&&process.env.APOGEE_LOCAL_PREVIEW!=="1",follow:true}};
}

export default function PrivacyPage() {
  const ready=privacyPolicyReady();
  if(!ready && process.env.APOGEE_LOCAL_PREVIEW!=="1")notFound();
  return <main id="experiencia" className={styles.page}>
    <Link href="/">Apogee · Voltar ao início</Link>
    <header><p>Privacidade e proteção de dados</p><h1>Política de Privacidade</h1><p>Versão de 30 de outubro de 2026</p></header>
    {!ready && <aside role="note" className={styles.draft}><strong>Minuta para revisão</strong><p>Identificação e contato já foram informados. O texto e os procedimentos de atendimento e proteção de menores ainda precisam de revisão e aprovação antes da publicação.</p></aside>}
    <p><Link href="/termos">Termos de Uso</Link></p>
    <section aria-labelledby="controlador"><h2 id="controlador">Quem é responsável pelos dados</h2>
      <p>O controlador responsável pelo tratamento descrito nesta política é <strong>{privacyIdentity.name}</strong>, CNPJ {privacyIdentity.document}, responsável pela Apogee.{privacyIdentity.location && <> Localização: {privacyIdentity.location}.</>}</p>
      <p>Canal de privacidade: {privacyIdentity.email?<a href={`mailto:${privacyIdentity.email}`}>{privacyIdentity.email}</a>:"a confirmar nesta minuta"}. Use este canal para pedidos sobre dados pessoais e para contato com o responsável por privacidade.</p>
    </section>
    <nav aria-label="Nesta política"><ul>{privacySections.map(section=><li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul></nav>
    {privacySections.map(section=><section key={section.id} aria-labelledby={section.id}><h2 id={section.id}>{section.title}</h2>{section.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}
      {section.id==="google-agenda" && <p><a href="https://developers.google.com/terms/api-services-user-data-policy">Política de dados de usuários das APIs Google</a> · <a href="https://myaccount.google.com/connections">Gerenciar conexões da Conta Google</a></p>}
    </section>)}
    <section><h2>Referências</h2><ul>
      <li><a href="https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html">LGPD: Lei nº 13.709/2018, texto atualizado</a></li>
      <li><a href="https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes">Orientações da ANPD e direitos dos titulares</a></li>
      <li><a href="https://www.gov.br/anpd/pt-br/assuntos/eca-digital/">ECA Digital: orientações da ANPD</a></li>
    </ul></section>
  </main>;
}
