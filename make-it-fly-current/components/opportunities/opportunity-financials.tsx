import { interfaceText } from "@/lib/presentation-text.mjs";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { formatMoneyText, moneyTextParts } from "@/lib/opportunities/money";
import styles from "./opportunities.module.css";

export function OpportunityBenefits({ opportunity }: { opportunity: StudentOpportunity }) {
  if (!opportunity.financials?.benefits.length) return null;
  return <div className={styles.financialBenefits} aria-label="Benefício financeiro confirmado">
    {opportunity.financials.benefits.map((benefit, index) => <div key={index}>
      <span className={styles.financialLabel}>{benefit.label}</span>
      <p>{moneyTextParts(interfaceText(benefit.text)).map((part, i) => part.money
        ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>)}</p>
    </div>)}
  </div>;
}

export function OpportunityCosts({ opportunity }: { opportunity: StudentOpportunity }) {
  const financials = opportunity.financials;
  const notes = financials ? financials.notes : [opportunity.benefit];
  return <>
    {financials?.costs.length ? <div><dt>Participação</dt><dd className={styles.participationCost}>
      {financials.costs.map((cost, index) => <p key={index}>{interfaceText(formatMoneyText(cost))}</p>)}
    </dd></div> : null}
    {notes.length ? <div><dt>Apoio e condições</dt><dd>
      {notes.map((note, index) => <p key={index}>{interfaceText(formatMoneyText(note))}</p>)}
    </dd></div> : null}
  </>;
}
