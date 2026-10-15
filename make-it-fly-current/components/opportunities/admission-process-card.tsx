import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AdmissionGroup } from "@/lib/opportunities/admission-processes";
import { OpportunityBenefits, OpportunityCosts } from "./opportunity-financials";
import { OpportunityCountdown } from "./opportunity-countdown";
import styles from "./opportunities.module.css";

export function AdmissionProcessCard({ group, management = false }: { group: AdmissionGroup; management?: boolean }) {
  const first = group.courses[0];
  const sharedWindow = group.courses.every((course) => course.deadline === first.deadline && course.deadlineAt === first.deadlineAt && course.opportunityStatus === first.opportunityStatus);
  const sharedUrl = group.courses.every((course) => course.officialUrl === first.officialUrl);
  return <article className={styles.card}>
    <div className={styles.cardTopline}><span className={styles.kind}>Ingresso por vestibular{sharedWindow && first.opportunityStatus === "upcoming" ? " · Em breve" : ""}</span></div>
    <div className={styles.cardMain}>
      <p className={styles.organization}>{first.organization}</p>
      <h4>{group.title}</h4>
      <p className={styles.summary}>Um processo seletivo · {group.courses.length} {group.courses.length === 1 ? "opção de curso corresponde" : "opções de curso correspondem"} aos filtros.</p>
    </div>
    <p className={styles.admissionDeadline}>{sharedWindow ? first.deadlineLabel : "Consulte o prazo de cada opção de curso."}</p>
    {sharedWindow ? <OpportunityCountdown opportunity={first} /> : null}
    <details className={styles.admissionOptions}>
      <summary>Ver cursos, câmpus e requisitos ({group.courses.length})</summary>
      <ul>{group.courses.map((course) => <li key={course.id}>
        <h5>{course.title}</h5>
        <p>{course.location} · {course.level}</p>
        <p>{course.eligibility}</p>
        <OpportunityBenefits opportunity={course} />
        <dl className={styles.details}><OpportunityCosts opportunity={course} /></dl>
        {!sharedWindow ? <p>{course.deadlineLabel}{course.opportunityStatus === "upcoming" ? " · Inscrições futuras" : ""}</p> : null}
        {!sharedUrl ? <Link className={styles.externalLink} href={course.officialUrl} target="_blank" rel="noopener noreferrer">Ver fonte oficial deste curso</Link> : null}
        <p>{course.verificationMethod === "admin" ? "Atualizado pela equipe" : "Fonte consultada"} em <time dateTime={course.verificationTimestamp ?? course.verifiedAt}>{course.verifiedAt.split("-").reverse().join("/")}</time></p>
        {management ? <Link className={styles.externalLink} href={`/admin/radar?editar=${encodeURIComponent(course.id.replace(/^radar-/, ""))}`}>Editar ou excluir este curso</Link> : null}
      </li>)}</ul>
    </details>
    {sharedUrl ? <div className={styles.cardFooter}>
      <Link className={styles.externalLink} href={first.officialUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver página oficial de ${group.title}`}>
        Ver processo seletivo <ArrowUpRight size={16} aria-hidden />
      </Link>
    </div> : null}
  </article>;
}
