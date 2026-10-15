import { expect, it } from "vitest";
import publishedIfsc from "./fixtures/ifsc-published-course-selection.json";
import { admissionProcessFor } from "@/lib/ingestion/admission-process";
it("agrupa apenas as edições auditadas por prova e preserva cursos sem vestibular", () => {
  const ifsc = { isCourse: true, officialUrl: "https://www.ifsc.edu.br/tecnicos", requirementsText: "Médio Técnico em Informática no Câmpus X; seleção por prova. Oferta: 40 vagas." };
  expect(admissionProcessFor("ifsc-technical-courses-2027", ifsc)?.id).toBe("ifsc-technical-exam-2027-1");
  for (const patch of [{ requirementsText: ifsc.requirementsText.replace("prova", "sorteio") }, { requirementsText: "Não exige seleção por prova." }, { isCourse: false }, { officialUrl: "https://untrusted.example/cursos" }]) expect(admissionProcessFor("ifsc-technical-courses-2027", { ...ifsc, ...patch })).toBeNull();
  expect(admissionProcessFor("different-edition", ifsc)).toBeNull();
  expect(admissionProcessFor("ifc-integrated-technical-2027", { isCourse: true, officialUrl: "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/cursos/", requirementsText: "Seleção por Exame de Classificação; 40 vagas." })?.id).toBe("ifc-integrated-exam-2027");
});

it("classifica as 103 opções reais do IFSC sem deixar a pontuação separar cursos do mesmo exame", () => {
 const groups = publishedIfsc.map((item) => admissionProcessFor("ifsc-technical-courses-2027", item));
 expect(groups.filter(Boolean)).toHaveLength(59);
 expect(groups.filter((item) => !item)).toHaveLength(44);
 const colon = publishedIfsc.filter((item) => item.requirementsText.includes("seleção por prova:"));
 expect(colon).toHaveLength(57); expect(colon.every((item) => admissionProcessFor("ifsc-technical-courses-2027", item))).toBe(true);
 const lottery = publishedIfsc.filter((item) => /seleção por (?:sorteio|ordem de inscrição)/.test(item.requirementsText));
 expect(lottery).toHaveLength(44); expect(lottery.every((item) => !admissionProcessFor("ifsc-technical-courses-2027", item))).toBe(true);
});
