import Link from "next/link";
import {notFound} from "next/navigation";
import {privacyIdentity,privacyPolicyReady,privacySections,privacySectionsWithRadar,publishedPrivacyVersion} from "@/lib/privacy-policy";
import {legalDocumentVersions} from "@/lib/legal-documents.mjs";
import {radarAmplitudePrivacyAnchor} from "@/lib/radar-amplitude-contract";
import styles from "./privacy.module.css";

const radarPrivacyTitle = "Medição opcional de uso do Radar com Amplitude";
const radarPrivacyHref = `#${radarAmplitudePrivacyAnchor}`;

export const dynamic="force-dynamic";
export function generateMetadata() {
  return {title:"Política de Privacidade | Apogee",description:"Como a Apogee trata dados pessoais e como exercer seus direitos de privacidade.",
    alternates:{canonical:"/privacidade"},robots:{index:privacyPolicyReady()&&process.env.APOGEE_LOCAL_PREVIEW!=="1",follow:true}};
}

export default function PrivacyPage() {
  const publishedVersion = publishedPrivacyVersion();
  const preview = process.env.APOGEE_LOCAL_PREVIEW === "1";
  if (!publishedVersion && !preview) notFound();
  const version = preview ? legalDocumentVersions.privacy : publishedVersion;
  const includesRadar = version === legalDocumentVersions.privacy;
  const sections = includesRadar ? privacySectionsWithRadar : privacySections;
  return <main id="experiencia" className={styles.page}>
    <Link href="/">Apogee · Voltar ao início</Link>
    <header><p>Privacidade e proteção de dados</p><h1>Política de Privacidade</h1><p>Versão {version}</p></header>
    {preview && publishedVersion !== version && <aside role="note" className={styles.draft}><strong>Prévia local</strong><p>Versão preparada para publicação.</p></aside>}
    <p><Link href="/termos">Termos de Uso</Link></p>
    <section aria-labelledby="controlador"><h2 id="controlador">Quem é responsável pelos dados</h2>
      <p>O controlador responsável pelo tratamento descrito nesta política é <strong>{privacyIdentity.name}</strong>, CNPJ {privacyIdentity.document}, responsável pela Apogee.{privacyIdentity.location && <> Localização: {privacyIdentity.location}.</>}</p>
      <p>Canal de privacidade: {privacyIdentity.email?<a href={`mailto:${privacyIdentity.email}`}>{privacyIdentity.email}</a>:"a confirmar nesta minuta"}. Use este canal para pedidos sobre dados pessoais e para contato com o responsável por privacidade.</p>
    </section>
    <nav aria-label="Nesta política"><ul>
      {sections.map(section=><li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}
      {includesRadar && <li><a href={radarPrivacyHref}>{radarPrivacyTitle}</a></li>}
    </ul></nav>
    {sections.map(section=><section key={section.id} aria-labelledby={section.id}><h2 id={section.id}>{section.title}</h2>{section.paragraphs.map((paragraph, index)=><p key={paragraph}>
      {paragraph}
      {includesRadar && section.id === "dados" && index === section.paragraphs.length - 1 && <> Saiba mais em <a href={radarPrivacyHref}>{radarPrivacyTitle}</a>.</>}
      {includesRadar && section.id === "retencao" && index === 0 && <> Consulte o prazo do piloto em <a href={radarPrivacyHref}>{radarPrivacyTitle}</a>.</>}
    </p>)}
      {section.id==="google-agenda" && <p><a href="https://developers.google.com/terms/api-services-user-data-policy">Política de dados de usuários das APIs Google</a> · <a href="https://myaccount.google.com/connections">Gerenciar conexões da Conta Google</a></p>}
    </section>)}
    {includesRadar && <section aria-labelledby={radarAmplitudePrivacyAnchor}>
      <h2 id={radarAmplitudePrivacyAnchor}>{radarPrivacyTitle}</h2>
      <p>Quando o piloto estiver disponível, pessoas com e-mail confirmado e revisão de maioridade aprovada poderão escolher se querem participar. A Apogee usa o consentimento específico para entender como as pessoas descobrem e salvam oportunidades e quantas abrem os links oficiais. A escolha é feita nas <strong>Preferências de medição do Radar</strong>, independentemente da escolha sobre as contagens agregadas do site. Você pode recusar ou revogar a permissão e continuar usando o Radar de acordo com as condições normais de acesso da sua conta.</p>
      <p>Se você permitir, a Apogee registra a data e a versão da sua autorização e mede quatro ações: visualização da lista do Radar, abertura dos detalhes de uma oportunidade, salvamento confirmado na sua agenda e clique em um link oficial.</p>
      <p>Para cada ação, a Apogee envia ao Amplitude apenas o tipo e o horário do evento, um identificador do evento e um código gerado no servidor para representar sua conta. Esse código pseudônimo permite reunir as ações da mesma conta ao longo do piloto. A Apogee usa esses registros para calcular as etapas até o salvamento e o total de cliques em links oficiais.</p>
      <p>O Amplitude presta o serviço de medição à Apogee. O projeto está na região europeia do fornecedor, e o envio envolve tratamento internacional. A janela de retenção dos eventos no projeto é de <strong>três meses</strong> a partir do recebimento pelo Amplitude. Para informações sobre o tratamento, pedidos de acesso ou pedidos de exclusão, escreva para <a href="mailto:contato@apogee.community">contato@apogee.community</a>.</p>
      <p>Você pode revogar a permissão a qualquer momento em <strong>Preferências de medição do Radar</strong>. A revogação interrompe novos envios da sua conta, inclusive em outras abas e dispositivos. Uma transmissão já iniciada pode ser concluída. Os eventos já recebidos seguem o prazo de retenção do projeto e podem ser objeto de um pedido de exclusão. Enquanto o navegador sinalizar Do Not Track ou Global Privacy Control, os envios originados nesse navegador ficam bloqueados.</p>
    </section>}
    <section><h2>Referências</h2><ul>
      <li><a href="https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html">LGPD: Lei nº 13.709/2018, texto atualizado</a></li>
      <li><a href="https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes">Orientações da ANPD e direitos dos titulares</a></li>
      <li><a href="https://www.gov.br/anpd/pt-br/assuntos/eca-digital/">ECA Digital: orientações da ANPD</a></li>
    </ul></section>
  </main>;
}
