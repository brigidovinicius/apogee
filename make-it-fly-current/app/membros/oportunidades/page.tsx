import type { Metadata } from "next";
import { MemberBar } from "@/components/members/member-bar";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import styles from "@/components/members/members.module.css";
import { requireMember } from "@/lib/members/dal";
import { listMemberOpportunityPage } from "@/lib/opportunities/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar de oportunidades",
  description: "Oportunidades estudantis completas para membros da comunidade Apogee.",
};

export default async function MemberOpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A DAL repete a autenticação antes de ler o catálogo de cards.
  const member = await requireMember("/membros/oportunidades");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const catalogue = await listMemberOpportunityPage(params).catch(() => null);

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="radar" />
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Área de membros · Radar de oportunidades</p>
          <h1 className={styles.title}>Radar de oportunidades</h1>
          <p className={styles.lead}>
            Escolha uma oportunidade para acessar os detalhes grátis. Para explorar as demais, compre o acesso vitalício por R$ 49,00.
          </p>
        </div>
      </header>
      {catalogue ? <OpportunitiesBoard opportunities={catalogue.opportunities} catalogue={catalogue} editorialFeed /> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes.</p>}
    </div>
  );
}
