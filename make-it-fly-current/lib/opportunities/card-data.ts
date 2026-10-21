import type { StudentOpportunity } from "./types";

/** Explicit public allowlist, shared by the homepage and both catalogues.
 * Protected values never reach HTML, RSC payloads or client component props.
 */
export function opportunityCardData(item: StudentOpportunity): StudentOpportunity {
  return {
    id: item.id, title: item.title, organization: item.organization, kind: item.kind, level: item.level,
    categories: item.categories, participationFormat: item.participationFormat, explicitlyUnpaid: item.explicitlyUnpaid,
    entranceExam: item.entranceExam, editorialNature: item.editorialNature, editorialFocus: item.editorialFocus,
    financials: item.financials ? { benefits: item.financials.benefits, costs: [], notes: [] } : undefined,
    admissionProcess: item.admissionProcess, location: item.location, stateCode: item.stateCode,
    cityName: item.cityName, nationallyEligible: item.nationallyEligible,
    summary: item.summary, benefit: item.benefit, eligibility: "", officialUrl: "",
    deadline: item.deadline, deadlineAt: item.deadlineAt, deadlineLabel: item.deadlineLabel,
    eventStartsAt: item.eventStartsAt, deadlineUnknown: item.deadlineUnknown,
    verifiedAt: item.verifiedAt, verificationTimestamp: item.verificationTimestamp,
    opportunityStatus: item.opportunityStatus, verificationMethod: item.verificationMethod,
  };
}
