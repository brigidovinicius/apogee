import { isExpansionSource, normalizeExpansion } from "./normalize-expansion";
import { FAPESC_CTI_ID, normalizeFapescCti } from "./normalize-fapesc-cti-2026";
import { isDiscoveryCall, normalizeDiscoveryCall } from "./normalize-discovery-calls-20261030";
import { sinterDiscoveryCall, normalizeSinterDiscoveryCall } from "./normalize-sinter-discovery-20261030";
import { isAuditedYouthCall, normalizeAuditedYouthCall } from "./normalize-audited-youth-calls";
import { isCommunityEdition, communityEditionSupplement, normalizeCommunityEdition } from "./normalize-community-editions-20261020";
import { AMAZONIA_ID, AMAZONIA_DOCUMENT_URL, isExtracurricularEdition, normalizeExtracurricularEdition } from "./normalize-extracurricular-20261017";
import { CPS_CULTURAL_ID, CPS_CULTURAL_NEWS, normalizeCpsCultural } from "./normalize-cps-cultural";
import { ACIM_SW_SOURCE_ID, normalizeAcimStartupWeekend } from "./normalize-acim-startup-weekend";
import { AXIA_ID, normalizeAxiaInternship } from "./normalize-axia-internship";
import { isScHackathon, normalizeScHackathon } from "./normalize-sc-hackathons";
import { normalizeIfcIntegratedCourses } from "./normalize-ifc-integrated";
import { normalizeIfscTechnicalCourses } from "./normalize-ifsc-technical";
import { normalizeSenacPsgCourses } from "./normalize-senac-psg";
import { normalizeJoinvilleInternship, normalizeTrtHackathon, JOINVILLE_INTERNSHIP_EDICT } from "./normalize-sc-priority";
import { IFC_APPLICATION_URL } from "./normalize-ifc-integrated";
import type { OfficialSource } from "./types";
import { normalizeIfscQualification } from "./normalize-ifsc-qualification";
import { PDAI_SOURCE_ID, PDAI_NEWS_URL, normalizeCapesPdai } from "./normalize-capes-pdai";
import { PDSE_SOURCE_ID, PDSE_NEWS_URL, normalizeCapesPdse } from "./normalize-capes-pdse";
import { cnpqCall, cnpqDocumentUrl, normalizeCnpqAuditedCall } from "./normalize-cnpq-audited-calls";
import { ufscAuditedCall, normalizeUfscAuditedCall } from "./normalize-ufsc-audited-calls";
import { ICIF_ID, ICIF_DOCUMENT, IEG_ID, additionalCallUrl, normalizeAdditionalCall } from "./normalize-additional-calls-20261027";
import { calendarSource } from "./calendar-sources";
import { normalizeCalendarSource } from "./normalize-calendar-sources";

export function programmeCataloguePageCount(id: string) {
  if (isExpansionSource(id)) return 1;
  if (id === FAPESC_CTI_ID) return 1;
  if (isDiscoveryCall(id)) return 1;
  if (sinterDiscoveryCall(id)) return 2;
  if (calendarSource(id)) return 1;
  if (id === ICIF_ID) return 2;
  if (id === IEG_ID) return 1;
  if (ufscAuditedCall(id)) return 2;
  if (cnpqCall(id)) return 2;
  if (isCommunityEdition(id)) return communityEditionSupplement(id) ? 2 : 1;
  if (isExtracurricularEdition(id)) return id === AMAZONIA_ID ? 2 : 1;
  if (isAuditedYouthCall(id)) return 1;
  if (id === CPS_CULTURAL_ID) return 2;
  if (id === AXIA_ID) return 1;
  if (isScHackathon(id)) return 1;
  return ["ifc-integrated-technical-2027", "joinville-paid-internship-003-2025", PDAI_SOURCE_ID, PDSE_SOURCE_ID].includes(id) ? 2 :
    [ACIM_SW_SOURCE_ID, "ifsc-technical-courses-2027", "ifsc-qualification-courses-2026-2", "senac-sc-psg-open-cohorts", "trt-udesc-hackathon-2026"].includes(id) ? 1 : null;
}

export function programmeSupplementUrl(id: string) {
  const sinterCall = sinterDiscoveryCall(id);
  if (sinterCall) return sinterCall.supplement;
  if (id === ICIF_ID) return ICIF_DOCUMENT;
  const ufscCall = ufscAuditedCall(id);
  if (ufscCall) return ufscCall.supplement;
  const call = cnpqCall(id);
  if (call) return cnpqDocumentUrl(call);
  if (isCommunityEdition(id)) return communityEditionSupplement(id)!;
  if (id === AMAZONIA_ID) return AMAZONIA_DOCUMENT_URL;
  if (id === CPS_CULTURAL_ID) return CPS_CULTURAL_NEWS;
  if (id === PDAI_SOURCE_ID) return PDAI_NEWS_URL;
  if (id === PDSE_SOURCE_ID) return PDSE_NEWS_URL;
  return id === "joinville-paid-internship-003-2025" ? JOINVILLE_INTERNSHIP_EDICT : IFC_APPLICATION_URL;
}

export function programmeCatalogueCanBeEmpty(id: string) {
  return id === ACIM_SW_SOURCE_ID || id === "senac-sc-psg-open-cohorts" || id === PDAI_SOURCE_ID || id === PDSE_SOURCE_ID;
}

export function normalizeProgrammeCatalogue(listing: string, application: string, source: OfficialSource) {
  if (isExpansionSource(source.id)) return normalizeExpansion(listing, source);
  if (source.id === FAPESC_CTI_ID) return normalizeFapescCti(listing, source);
  if (isDiscoveryCall(source.id)) return normalizeDiscoveryCall(listing, source);
  if (sinterDiscoveryCall(source.id)) return normalizeSinterDiscoveryCall(listing, application, source);
  if (calendarSource(source.id)) return normalizeCalendarSource(listing, source);
  if (additionalCallUrl(source.id)) return normalizeAdditionalCall(listing, application, source);
  if (ufscAuditedCall(source.id)) return normalizeUfscAuditedCall(listing, application, source);
  if (cnpqCall(source.id)) return normalizeCnpqAuditedCall(listing, application, source);
  if (isCommunityEdition(source.id)) return normalizeCommunityEdition(listing, application, source);
  if (isExtracurricularEdition(source.id)) return normalizeExtracurricularEdition(listing, application, source);
  if (isAuditedYouthCall(source.id)) return normalizeAuditedYouthCall(listing, source);
  if (source.id === CPS_CULTURAL_ID) return normalizeCpsCultural(listing, application, source);
  if (source.id === AXIA_ID) return normalizeAxiaInternship(listing, source);
  if (isScHackathon(source.id)) return normalizeScHackathon(listing, source);
  if (source.id === ACIM_SW_SOURCE_ID) return normalizeAcimStartupWeekend(listing, source);
  if (source.id === PDAI_SOURCE_ID) return normalizeCapesPdai(listing, application, source);
  if (source.id === PDSE_SOURCE_ID) return normalizeCapesPdse(listing, application, source);
  if (source.id === "ifsc-qualification-courses-2026-2") return normalizeIfscQualification(listing, source);
  if (source.id === "ifc-integrated-technical-2027") return normalizeIfcIntegratedCourses(listing, application, source);
  if (source.id === "senac-sc-psg-open-cohorts") return normalizeSenacPsgCourses(listing, source);
  if (source.id === "joinville-paid-internship-003-2025") return normalizeJoinvilleInternship(listing, application, source);
  if (source.id === "trt-udesc-hackathon-2026") return normalizeTrtHackathon(listing, source);
  return normalizeIfscTechnicalCourses(listing, source);
}
