import { interfaceText } from "@/lib/presentation-text.mjs";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AdmissionGroup } from "@/lib/opportunities/admission-processes";
import { OpportunityBenefits, OpportunityCosts } from "./opportunity-financials";
import { OpportunityCountdown } from "./opportunity-countdown";
import styles from "./opportunities.module.css";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";

export function AdmissionProcessCard({ group, management = false }: { group: AdmissionGroup; management?: boolean }) {
  const first = group.courses[0];
  const sharedWindow = group.courses.every((course) => course.deadline === first.deadline && course.deadlineAt === first.deadlineAt && course.opportunityStatus === first.opportunityStatus);
  const sharedUrl = group.courses.every((course) => course.officialUrl === first.officialUrl);
  return <article className={styles.card}>
    <div className={styles.cardTopline}><span className={styles.kind}>Ingresso por vestibular{sharedWindow && first.opportunityStatus === "upcoming" ? " · Em breve" : ""}</span></div>
    <div className={styles.cardMain}>
      <p className={styles.organization}>{interfaceText(first.organization)}</p>
      <h3>{interfaceText(group.title)}</h3>
      <p className={styles.summary}>Um processo seletivo · {group.courses.length} {group.courses.length === 1 ? "opção de curso corresponde" : "opções de curso correspondem"} aos filtros.</p>
    </div>
    <p className={styles.coursePreview}>{[...new Set(group.courses.map(course => interfaceText(course.title).split(/ [\u2013\u2014-] /)[0]))].slice(0, 4).join(" · ")}{group.courses.length > 4 ? " e outros." : ""}</p>
    <p className={styles.admissionDeadline}>{sharedWindow ? interfaceText(first.deadlineLabel) : "Consulte o prazo de cada opção de curso."}</p>
    {sharedWindow && first.deadline && !first.deadlineAt ? <small>Horário de encerramento não informado.</small> : null}
    {sharedWindow ? <OpportunityCountdown opportunity={first} /> : null}
    <details className={styles.admissionOptions}>
      <summary>{management ? "Ver cursos e requisitos" : "Ver cursos"} ({group.courses.length})</summary>
      <ul tabIndex={0} aria-label="Cursos, câmpus, vagas e requisitos disponíveis">{group.courses.map((course) => <li key={course.id}>
        <h4>{interfaceText(course.title)}</h4>
        <p>{interfaceText(course.location)} · {course.level}</p>
        {management ? <p>{interfaceText(course.eligibility)}</p> : null}
        <OpportunityBenefits opportunity={course} />
        {management ? <dl className={styles.details}><OpportunityCosts opportunity={course} /></dl> : null}
        {!sharedWindow ? <p>{interfaceText(course.deadlineLabel)}{course.opportunityStatus === "upcoming" ? " · Inscrições futuras" : ""}</p> : null}
        {!management ? <Link prefetch={false} className={styles.externalLink} href={opportunityDetailPath(course.id)}>Ver detalhes deste curso</Link> : !sharedUrl ? <Link className={styles.externalLink} href={course.officialUrl} target="_blank" rel="noopener noreferrer">Ver fonte oficial deste curso</Link> : null}
        <p>{course.verificationMethod === "admin" ? "Atualizado pela equipe" : "Fonte consultada"} em <time dateTime={course.verificationTimestamp ?? course.verifiedAt}>{course.verifiedAt.split("-").reverse().join("/")}</time></p>
        {management ? <Link className={styles.externalLink} href={`/admin/radar?editar=${encodeURIComponent(course.id.replace(/^radar-/, ""))}`}>Editar ou excluir este curso</Link> : null}
      </li>)}</ul>
    </details>
    {management && sharedUrl ? <div className={styles.cardFooter}>
      <Link className={styles.externalLink} href={first.officialUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver página oficial de ${interfaceText(group.title)}`}>
        Ver processo seletivo <ArrowUpRight size={16} aria-hidden />
      </Link>
    </div> : null}
  </article>;
}
