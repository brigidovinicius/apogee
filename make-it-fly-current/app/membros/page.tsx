import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/components/members/format";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { requireMember } from "@/lib/members/dal";
import { listCategories } from "@/lib/members/forum";

export const metadata: Metadata = { title: "Fórum" };

export default async function ForumHomePage() {
  const member = await requireMember("/membros");
  const categories = await listCategories();

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="forum" />
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Comunidade Apogee</p>
          <h1 className={styles.title}>Fórum</h1>
          <p className={styles.lead}>Olá, {member.name.split(" ")[0]}. Escolha uma categoria para conversar.</p>
        </div>
      </header>

      <section className={styles.radarEntry} aria-labelledby="radar-entry-title">
        <div>
          <p className={styles.radarEntryEyebrow}>Área exclusiva para membros</p>
          <h2 id="radar-entry-title">Radar de Oportunidades</h2>
          <p>
            Encontre bolsas, programas e intercâmbios com critérios, apoios, prazos e fontes oficiais.
          </p>
        </div>
        <Link className={styles.radarEntryLink} href="/membros/oportunidades">
          Abrir Radar completo <span aria-hidden="true">→</span>
        </Link>
      </section>

      {categories.length === 0 ? (
        <p className={styles.empty}>Nenhuma categoria criada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {categories.map((category) => (
            <li className={styles.listItem} key={category.id}>
              <div>
                <h2>
                  <Link href={`/membros/forum/${category.slug}`}>{category.name}</Link>
                </h2>
                {category.description ? <p>{category.description}</p> : null}
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
    </div>
  );
}
