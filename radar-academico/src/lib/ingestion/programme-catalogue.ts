import { normalizeIfcIntegratedCourses } from "./normalize-ifc-integrated";
import { normalizeIfscTechnicalCourses } from "./normalize-ifsc-technical";
import { normalizeSenacPsgCourses } from "./normalize-senac-psg";
import type { OfficialSource } from "./types";

export function programmeCataloguePageCount(id: string) {
  return id === "ifc-integrated-technical-2027" ? 2 : ["ifsc-technical-courses-2027", "senac-sc-psg-open-cohorts"].includes(id) ? 1 : null;
}

export function normalizeProgrammeCatalogue(listing: string, application: string, source: OfficialSource) {
  if (source.id === "ifc-integrated-technical-2027") return normalizeIfcIntegratedCourses(listing, application, source);
  if (source.id === "senac-sc-psg-open-cohorts") return normalizeSenacPsgCourses(listing, source);
  return normalizeIfscTechnicalCourses(listing, source);
}
