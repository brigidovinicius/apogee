import { normalizeIfcIntegratedCourses } from "./normalize-ifc-integrated";
import { normalizeIfscTechnicalCourses } from "./normalize-ifsc-technical";
import type { OfficialSource } from "./types";

export function programmeCataloguePageCount(id: string) {
  return id === "ifc-integrated-technical-2027" ? 2 : id === "ifsc-technical-courses-2027" ? 1 : null;
}

export function normalizeProgrammeCatalogue(listing: string, application: string, source: OfficialSource) {
  return source.id === "ifc-integrated-technical-2027"
    ? normalizeIfcIntegratedCourses(listing, application, source)
    : normalizeIfscTechnicalCourses(listing, source);
}
