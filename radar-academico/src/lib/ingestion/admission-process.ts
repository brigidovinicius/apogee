/** Only individually audited editions with an explicit exam selection enter a group. */
export function admissionProcessFor(sourceId: string, item: { isCourse?: boolean; requirementsText?: string; officialUrl?: string }) {
  if (!item.isCourse) return null;
  const definitions = [
    { sourceId: "ifsc-technical-courses-2027", id: "ifsc-technical-exam-2027-1", title: "IFSC — ingresso por prova 2027.1", url: "https://www.ifsc.edu.br/tecnicos", proof: /; seleção por prova(?:[:.;]|$)/i },
    { sourceId: "ifc-integrated-technical-2027", id: "ifc-integrated-exam-2027", title: "IFC — Exame de Classificação 2027", url: "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/cursos/", proof: /Seleção por Exame de Classificação;/i },
  ];
  const match = definitions.find((d) => d.sourceId === sourceId && d.url === item.officialUrl && d.proof.test(item.requirementsText ?? ""));
  return match ? { id: match.id, title: match.title } : null;
}
