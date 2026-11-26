import Link from "next/link";
import { CommunityResourceCards } from "./community-resource-cards";
import type { PublishedResources } from "./community-deliverables";
import styles from "./community-offer.module.css";

export function MemberOfferOverview({ name, radarFullAccess, preview = false, annual = false, resources, nextStep }: {
  annual?: boolean;
  resources?: PublishedResources;
  name: string;
  radarFullAccess: boolean | null;
  preview?: boolean;
  nextStep?: { label: string; description: string; href: string };
}) {
  const step = nextStep ?? (resources?.ferramentas ? {
    label: "Escolher uma ferramenta",
    href: "/membros/ferramentas",
  } : {
    label: "Explorar o Radar",
    href: preview ? "/oportunidades" : "/membros/oportunidades",
  });
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="member-offer-title">
    <h2 data-ap-title="" id="member-offer-title">Olá, {name}</h2>
    <div data-ap-panel="" className={styles.nextStep}>
      <div><h3>Seu próximo passo</h3>{nextStep && <p>{nextStep.description}</p>}</div>
      <Link data-ap-button="primary" className={styles.button} prefetch={false} href={step.href}>{step.label}</Link>
    </div>
    <CommunityResourceCards resources={resources} destination={preview ? "preview" : "members"} />
    <p className={styles.access}>{annual ? "Assinatura anual ativa." : radarFullAccess ? "Radar completo ativo." : radarFullAccess === false ? "Conta gratuita: 10 consultas mensais no Radar e 10 em Benefícios." : ""} <Link href="/membros/assinatura">Ver meu acesso</Link></p>
  </section>;
}
