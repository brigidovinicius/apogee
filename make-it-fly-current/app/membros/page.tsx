import { MemberOfferOverview } from "@/components/community/member-offer-overview";
import { radarAccess } from "@/lib/billing/store";
import { interfaceText } from "@/lib/presentation-text.mjs";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/components/members/format";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { requireMember } from "@/lib/members/dal";
import { listCategories } from "@/lib/members/forum";

export const metadata: Metadata = { title: "Sua comunidade | Apogee" };

export default async function MemberHomePage() {
  const member = await requireMember("/membros");
  const categories = await listCategories();
  const access = await radarAccess(member.id, process.env.STRIPE_MODE !== "test").catch(() => null);

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="home" />
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Comunidade Apogee</p>
          <h1 className={styles.title}>Sua comunidade.</h1>
          <p className={styles.lead}>Conhecimento, oportunidades e conexões para construir mais.</p>
        </div>
      </header>

      <MemberOfferOverview name={interfaceText(member.name).split(" ")[0]} radarFullAccess={access?.active ?? null} />
      <section id="forum" aria-labelledby="member-forum-title"><h2 id="member-forum-title">Conversas da comunidade</h2>

      {categories.length === 0 ? (
        <p className={styles.empty}>Nenhuma categoria criada ainda</p>
      ) : (
        <ul className={styles.list}>
          {categories.map((category) => (
            <li className={styles.listItem} key={category.id}>
              <div>
                <h2>
                  <Link href={`/membros/forum/${category.slug}`}>{interfaceText(category.name)}</Link>
                </h2>
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
      </section>
    </div>
  );
}
