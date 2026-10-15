import { expect, it } from "vitest";
import { admissionProcessFor } from "@/lib/ingestion/admission-process";
it("agrupa apenas as edições auditadas por prova e preserva cursos sem vestibular", () => {
  const ifsc = { isCourse: true, officialUrl: "https://www.ifsc.edu.br/tecnicos", requirementsText: "Médio Técnico em Informática no Câmpus X; seleção por prova. Oferta: 40 vagas." };
  expect(admissionProcessFor("ifsc-technical-courses-2027", ifsc)?.id).toBe("ifsc-technical-exam-2027-1");
  for (const patch of [{ requirementsText: ifsc.requirementsText.replace("prova", "sorteio") }, { requirementsText: "Não exige seleção por prova." }, { isCourse: false }, { officialUrl: "https://untrusted.example/cursos" }]) expect(admissionProcessFor("ifsc-technical-courses-2027", { ...ifsc, ...patch })).toBeNull();
  expect(admissionProcessFor("different-edition", ifsc)).toBeNull();
  expect(admissionProcessFor("ifc-integrated-technical-2027", { isCourse: true, officialUrl: "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/cursos/", requirementsText: "Seleção por Exame de Classificação; 40 vagas." })?.id).toBe("ifc-integrated-exam-2027");
});
