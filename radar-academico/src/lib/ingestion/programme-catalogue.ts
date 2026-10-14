import { normalizeIfcIntegratedCourses } from "./normalize-ifc-integrated";
import { normalizeIfscTechnicalCourses } from "./normalize-ifsc-technical";
import { normalizeSenacPsgCourses } from "./normalize-senac-psg";
import { normalizeJoinvilleInternship, normalizeTrtHackathon, JOINVILLE_INTERNSHIP_EDICT } from "./normalize-sc-priority";
import { IFC_APPLICATION_URL } from "./normalize-ifc-integrated";
import type { OfficialSource } from "./types";

export function programmeCataloguePageCount(id: string) {
  return ["ifc-integrated-technical-2027", "joinville-paid-internship-003-2025"].includes(id) ? 2 :
    ["ifsc-technical-courses-2027", "senac-sc-psg-open-cohorts", "trt-udesc-hackathon-2026"].includes(id) ? 1 : null;
}

export function programmeSupplementUrl(id: string) {
  return id === "joinville-paid-internship-003-2025" ? JOINVILLE_INTERNSHIP_EDICT : IFC_APPLICATION_URL;
}

export function normalizeProgrammeCatalogue(listing: string, application: string, source: OfficialSource) {
  if (source.id === "ifc-integrated-technical-2027") return normalizeIfcIntegratedCourses(listing, application, source);
  if (source.id === "senac-sc-psg-open-cohorts") return normalizeSenacPsgCourses(listing, source);
  if (source.id === "joinville-paid-internship-003-2025") return normalizeJoinvilleInternship(listing, application, source);
  if (source.id === "trt-udesc-hackathon-2026") return normalizeTrtHackathon(listing, source);
  return normalizeIfscTechnicalCourses(listing, source);
}
