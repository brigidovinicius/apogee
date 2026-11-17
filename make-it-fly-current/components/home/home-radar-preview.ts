import "server-only";
import type { StudentOpportunity } from "@/lib/opportunities/types";

// Public homepage snapshot observed on 17/11/2026. Imported only by the explicit
// local development preview. Production always reads listPublicOpportunities.
export const homePreviewCapturedAt = "2026-11-17T12:00:00-03:00";
const common = {
  level: "Público diverso" as const, location: "Não informado na fonte pública", stateCode: null, cityName: null,
  eligibility: "", benefit: "", summary: "", deadline: null, deadlineLabel: "Prazo não informado",
  deadlineUnknown: true, officialUrl: "https://www.apogee.community/oportunidades", verifiedAt: "2026-11-17",
};
export const homePreviewOpportunities: StudentOpportunity[] = [
  { ...common, id: "radar-7f9a860a-93b9-4ba9-b4a6-8014f58de0a2", title: "Festive Hacks 2026 — hackathon presencial em Bengaluru, Índia", organization: "WeMakeDevs / WeAreDevelopers", kind: "Prêmio", categories: ["competicoes"], eventStartsAt: "2026-11-25T00:30:00-03:00" },
  { ...common, id: "radar-5c9247d7-9f89-470a-9b63-8bd10f1136a8", title: "Microsoft Imagine Cup 2027 — competição global de startups", organization: "Microsoft", kind: "Prêmio", categories: ["competicoes"], deadlineUnknown: false, deadline: "2027-03-01", deadlineAt: "2027-03-01T02:59:00-03:00", deadlineLabel: "1 de março de 2027" },
  { ...common, id: "radar-1be77ed9-9e2c-4732-ab7c-529d9a1c5ac7", title: "Builders Day · 1565 × Taicor", organization: "1565.io", kind: "Prêmio", categories: ["eventos"], eventStartsAt: "2026-11-28T09:00:00-03:00" },
  { ...common, id: "radar-771ee64a-ee0d-4cca-8eb9-e5142204c94f", title: "Brasil Global Summit 2026", organization: "Brasil Global", kind: "Programa", categories: ["eventos"], eventStartsAt: "2026-11-24" },
  { ...common, id: "radar-ed7e3c52-65a2-4ff2-8d71-fc4fe1994c0b", title: "CASE 2026", organization: "ABStartups", kind: "Programa", categories: ["eventos"], eventStartsAt: "2026-11-26" },
  { ...common, id: "radar-793895d5-7872-49f0-b98f-f0fbb91d3de7", title: "Founders Live Rio de Janeiro", organization: "Founders Live", kind: "Programa", categories: ["eventos"], eventStartsAt: "2026-11-17T19:00:00-03:00" },
];
