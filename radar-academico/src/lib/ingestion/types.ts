import type { BrazilianStateCode } from "@/lib/location";

export type SourceType =
  | "federal_government" | "state_government" | "government_foundation"
  | "federal_university" | "state_university" | "federal_institute"
  | "public_research_institution" | "official_reference";

export type ExtractionMode =
  | "rss" | "html" | "pdf" | "api" | "sitemap"
  | "manual_assisted" | "reference_only" | "disabled";

export type ReviewStatus =
  | "pending_review" | "needs_information" | "approved" | "rejected" | "archived";

export type OpportunityStatus =
  | "upcoming" | "open" | "closed" | "suspended" | "cancelled"
  | "result_published" | "unknown";

export type ApplicantType =
  | "undergraduate_student" | "postgraduate_student" | "high_school_student"
  | "graduate_professional" | "professor" | "researcher" | "company"
  | "institution" | "mixed";

export type ApplicationRoute =
  | "direct_student_application" | "application_via_university"
  | "application_via_department" | "application_via_professor"
  | "application_via_project_coordinator" | "institutional_call"
  | "invitation_only" | "unclear";

export type BenefitType =
  | "academic_scholarship" | "research_scholarship" | "extension_scholarship"
  | "monitor_scholarship" | "internship" | "financial_aid" | "housing_aid"
  | "mobility_aid" | "prize" | "project_funding" | "unpaid_opportunity" | "other";

export type DeadlinePrecision =
  | "exact_datetime" | "date_only" | "period_only" | "continuous_flow" | "not_informed";

export interface OfficialSource {
  id: string;
  name: string;
  institutionName: string;
  institutionAcronym: string;
  sourceType: SourceType;
  baseUrl: string;
  allowedDomains: string[];
  allowedPathPrefixes: string[];
  listingUrls: string[];
  extractionMode: ExtractionMode;
  audienceScope: ApplicantType[];
  geographicScope: string[];
  location?: { stateCode?: string | null; cityName?: string | null };
  categories: string[];
  priority: number;
  active: boolean;
  notes?: string;
}

export interface FieldEvidence {
  source_url: string;
  excerpt: string;
  page?: number;
}

export interface OpportunityCandidate {
  id?: string;
  officialSourceId: string;
  title: string;
  institution: string;
  sourcePageUrl: string;
  officialDocumentUrl?: string;
  applicationUrl?: string;
  applicantType: ApplicantType;
  applicationRoute: ApplicationRoute;
  benefitType: BenefitType;
  deadlineAt?: string;
  deadlinePrecision: DeadlinePrecision;
  requirementsText: string;
  amountText: string;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  reviewStatus: ReviewStatus;
  opportunityStatus: OpportunityStatus;
  evidenceJson: Record<string, FieldEvidence>;
  extractionMethod: ExtractionMode;
  contentHash: string;
  requiresManualReview?: boolean;
  hasRetification?: boolean;
  sourceConflict?: boolean;
}

export interface IngestionResult {
  sourceId: string;
  pagesChecked: number;
  discovered: OpportunityCandidate[];
  ignored: number;
  failed: number;
  locationRejected: number;
  warnings: string[];
}
