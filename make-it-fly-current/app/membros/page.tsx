import { MemberOfferOverview } from "@/components/community/member-offer-overview";
import { communityAccess } from "@/lib/billing/community-store";
import { radarAccess } from "@/lib/billing/store";
import { interfaceText } from "@/lib/presentation-text.mjs";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/components/members/format";
import { MemberWorkspace } from "@/components/members/member-workspace";
import styles from "@/components/members/members.module.css";
import { requireSignedInMember } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { LockedMemberArea } from "@/components/members/locked-member-area";
import { listCategories } from "@/lib/members/forum";
import { memberLearning } from "@/lib/deliverables/store";
import { MemberForumSection } from "@/components/members/member-forum-section";
import { memberResourceAvailability } from "@/lib/members/resource-availability";

export const metadata: Metadata = { title: "Sua comunidade | Apogee" };

export default async function MemberHomePage() {
  const member = await requireSignedInMember("/membros");
  const verified = await adultAccess(member.id);
  const categories = verified ? await listCategories() : [];
  const access = await radarAccess(member.id, process.env.STRIPE_MODE !== "test").catch(() => null);

  const annual = await communityAccess(member.id, process.env.STRIPE_MODE !== "test").catch(() => null);
  const resources = await memberResourceAvailability(member.id, member.role);
  const learning = resources.trilha ? await memberLearning().catch(() => null) : null;
  const activities = learning?.tracks.flatMap(track => learning.modules
    .filter(module => module.track_id === track.id)
    .flatMap(module => learning.activities.filter(activity => activity.module_id === module.id))) ?? [];
  const nextActivity = activities.find(activity => !activity.completed_at);

  return (
    <MemberWorkspace member={member} current="home"><div className={styles.container}>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Minha comunidade</h1>

        </div>
      </header>

      <MemberOfferOverview name={interfaceText(member.name).split(" ")[0]} radarFullAccess={access?.active ?? null} annual={annual?.active ?? false} resources={resources} nextStep={!verified ? {
        label: "Verificar minha conta", description: "Conclua a verificação para participar do fórum e acessar os recursos da sua conta.",
        href: "/membros/protecao?next=%2Fmembros",
      } : nextActivity ? {
        label: activities.some(activity => activity.completed_at) ? "Retomar a trilha" : "Começar a trilha",
        description: nextActivity.name, href: `/membros/trilha#atividade-${nextActivity.id}`,
      } : undefined} />
      <MemberForumSection><h2 data-ap-heading="section" data-ap-art="forum" id="member-forum-title">Conversas da comunidade</h2>

      {!verified ? <LockedMemberArea kind="forum" next="/membros#forum" reason="verification" /> : categories.length === 0 ? (
        <p className={styles.empty}>Nenhuma categoria criada ainda</p>
      ) : (
        <ul className={styles.list}>
          {categories.map((category) => (
            <li className={styles.listItem} key={category.id}>
              <div>
                <h3 data-ap-heading="" data-ap-art="forum">
                  <Link href={`/membros/forum/${category.slug}`}>{interfaceText(category.name)}</Link>
                </h3>
                {category.description ? <p>{interfaceText(category.description)}</p> : null}
                {category.lastPostAt ? (
                  <p className={styles.meta}>Última atividade em {formatDateTime(category.lastPostAt)}</p>
                ) : null}
              </div>
              <div className={styles.stats}>
                <span>
                  <strong>{category.topics}</strong>
                  {category.topics === 1 ? "tópico" : "tópicos"}
                </span>
                <span>
                  <strong>{category.replies}</strong>
                  {category.replies === 1 ? "resposta" : "respostas"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      </MemberForumSection>
    </div></MemberWorkspace>
  );
}
