import { ACIM_SW_SOURCE_ID, normalizeAcimStartupWeekend } from "./normalize-acim-startup-weekend";
import { normalizeIfcIntegratedCourses } from "./normalize-ifc-integrated";
import { normalizeIfscTechnicalCourses } from "./normalize-ifsc-technical";
import { normalizeSenacPsgCourses } from "./normalize-senac-psg";
import { normalizeJoinvilleInternship, normalizeTrtHackathon, JOINVILLE_INTERNSHIP_EDICT } from "./normalize-sc-priority";
import { IFC_APPLICATION_URL } from "./normalize-ifc-integrated";
import type { OfficialSource } from "./types";
import { normalizeIfscQualification } from "./normalize-ifsc-qualification";
import { PDAI_SOURCE_ID, PDAI_NEWS_URL, normalizeCapesPdai } from "./normalize-capes-pdai";
import { PDSE_SOURCE_ID, PDSE_NEWS_URL, normalizeCapesPdse } from "./normalize-capes-pdse";

export function programmeCataloguePageCount(id: string) {
  return ["ifc-integrated-technical-2027", "joinville-paid-internship-003-2025", PDAI_SOURCE_ID, PDSE_SOURCE_ID].includes(id) ? 2 :
    [ACIM_SW_SOURCE_ID, "ifsc-technical-courses-2027", "ifsc-qualification-courses-2026-2", "senac-sc-psg-open-cohorts", "trt-udesc-hackathon-2026"].includes(id) ? 1 : null;
}

export function programmeSupplementUrl(id: string) {
  if (id === PDAI_SOURCE_ID) return PDAI_NEWS_URL;
  if (id === PDSE_SOURCE_ID) return PDSE_NEWS_URL;
  return id === "joinville-paid-internship-003-2025" ? JOINVILLE_INTERNSHIP_EDICT : IFC_APPLICATION_URL;
}

export function programmeCatalogueCanBeEmpty(id: string) {
  return id === ACIM_SW_SOURCE_ID || id === "senac-sc-psg-open-cohorts" || id === PDAI_SOURCE_ID || id === PDSE_SOURCE_ID;
}

export function normalizeProgrammeCatalogue(listing: string, application: string, source: OfficialSource) {
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
