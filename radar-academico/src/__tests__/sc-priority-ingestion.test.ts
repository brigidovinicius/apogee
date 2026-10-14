import { expect, it } from "vitest";
import { normalizeJoinvilleInternship, normalizeTrtHackathon, normalizeUfscExchange, officialHackathonText,
  JOINVILLE_INTERNSHIP_URL, JOINVILLE_INTERNSHIP_EDICT, TRT_HACKATHON_URL, UFSC_AUGM_URL, UFSC_OUTGOING_URL } from "@/lib/ingestion/normalize-sc-priority";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const now = new Date("2026-10-14T15:00:00Z");
const source = (id: string, url: string): OfficialSource => ({ id, name: id, institutionName: id, institutionAcronym: "",
  sourceType: "official_reference", baseUrl: url, allowedDomains: [new URL(url).hostname, "sei.joinville.sc.gov.br"],
  allowedPathPrefixes: ["/"], listingUrls: [url], extractionMode: "html", audienceScope: ["mixed"],
  geographicScope: [], categories: [], priority: 1, active: true });
const joinville = source("joinville-paid-internship-003-2025", JOINVILLE_INTERNSHIP_URL);
const service = '<body>Processo Seletivo Estágio Remunerado Edital nº 003-2025-SGP Município de Joinville (SC) Eletrônicos Joinville Fácil 14/08/2025 até 13/08/2027 <a href="https://facil.joinville.sc.gov.br/">Inscreva-se</a></body>';
const edict = '<body>Cadastro de Reserva (CR) em estágio remunerado. 1,5 (um vírgula cinco) salário mínimo; 01 (um) salário mínimo. Inscrições de forma contínua. Candidato deve residir no Estado de Santa Catarina.</body>';

it("confirma serviço e edital remunerado juntos, sem multiplicar vagas de cadastro de reserva", () => {
  const items = normalizeJoinvilleInternship(service, edict, joinville, now);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ deadlineAt: "2027-08-13", opportunityStatus: "open", countryCode: "BR", stateCode: "SC", cityName: "Joinville", categories: ["carreira"] });
  expect(items[0].requirementsText).toContain("Cadastro de reserva, sem garantia");
  expect(items[0].amountText).toContain("1,5 salário mínimo");
  expect(items[0].amountText).not.toContain("R$");
  expect(items[0].evidenceJson.amount.source_url).toBe(JOINVILLE_INTERNSHIP_EDICT);
  expect(publicationIssue(items[0], joinville, now)).toBeNull();
  expect(normalizeJoinvilleInternship(service, "Bolsa a definir", joinville, now)).toEqual([]);
  expect(normalizeJoinvilleInternship(service.replace("13/08/2027", "31/02/2027"), edict, joinville, now)).toEqual([]);
  expect(normalizeJoinvilleInternship(service, edict, joinville, new Date("2027-08-14T12:00:00Z"))[0].opportunityStatus).toBe("closed");
});

const hackathon = source("trt-udesc-hackathon-2026", TRT_HACKATHON_URL);
const eventTexts = ["Hackathon · Tecnologia contra o Tráfico de Pessoas TRT-12 + UDESC", "DATA 07 de novembro de 2026 HORÁRIO Das 9h às 19h", "Connect — Ágora Tech Park, Joinville/SC",
  "Pessoas a partir de 16 anos, de qualquer área; menores precisam de termo de autorização do responsável legal.",
  "A participação é gratuita. Premiação R$ 13.000", "As inscrições abrem em 21 de setembro de 2026, às 12h", "60 vagas, preenchidas por ordem de inscrição. Quero Participar. Inscrições abertas até dia 28/10/2026"];
const eventHtml = (texts = eventTexts) => `<script>${JSON.stringify(Object.fromEntries(texts.map((text, index) => [`p-${index + 1}`, { "A?": "O", A: { A: { "A?": "A", A: text } } }])))}</script>`;

it("lê JSON público sem executar scripts e publica uma edição ampla com premiação e início comprovados", () => {
  const items = normalizeTrtHackathon(eventHtml(), hackathon, now);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ deadlineAt: "2026-10-28", eventStartsAt: "2026-11-07T09:00:00-03:00", categories: ["competicoes", "eventos"], cityName: "Joinville" });
  expect(items[0].requirementsText).toContain("sem formação acadêmica específica");
  expect(items[0].amountText).toContain("premiação total");
  expect(items[0].amountText).toContain("não é remuneração garantida");
  expect(publicationIssue(items[0], hackathon, now)).toBeNull();
  expect(officialHackathonText(eventHtml() + '<script>throw new Error("Never execute")</script>')).toContain("Quero Participar");
  expect(normalizeTrtHackathon(eventHtml(), hackathon, new Date("2026-10-29T12:00:00Z"))[0].opportunityStatus).toBe("closed");
});

it("não transforma datas de realização em prazo nem publica um hotsite sem requisitos ou inscrição", () => {
  expect(normalizeTrtHackathon(eventHtml(eventTexts.slice(0,-1)), hackathon, now)).toEqual([]);
  expect(normalizeTrtHackathon(eventHtml(eventTexts.filter((_,index)=>index!==3)), hackathon, now)).toEqual([]);
  expect(normalizeTrtHackathon(eventHtml().replace("28/10/2026", "28/11/2026"), hackathon, now)).toEqual([]);
  expect(normalizeTrtHackathon('<script>window.bootstrap = remoteCall()</script>', hackathon, now)).toEqual([]);
});

const augm = source("ufsc-augm-grado-2027-1", UFSC_AUGM_URL);
const augmText = "UNIVERSIDADE FEDERAL DE SANTA CATARINA EDITAL Nº 11/2026/SINTER 1 º SEMESTRE DE 202 7. 11 (onze) vagas. Inscrições pelo https://caufsc.sistemas.ufsc.br/ no período de 2 2 de setembro a 21 de outubro de 2026. Ter completado pelo menos 30% do curso; espanhol nível B1 (intermediário). Isenção de taxas acadêmicas na universidade de destino. Bolsa para auxílio no custeio às despesas de hospedagem e alimentação.";
const outgoing = source("ufsc-outgoing-2027-1", UFSC_OUTGOING_URL);
const outgoingText = "UNIVERSIDADE FEDERAL DE SANTA CATARINA EDITAL Nº 2/SINTER/2026. 1º de fevereiro a 31 de maio de 2026 (Intercâmbio em 2026.2) e 1º de agosto a 15 de novembro 1\nde 2026 (Intercâmbio em 2027.1). https://sinter.ufsc.br/informacoes-para-intercambio/ Ter pelo menos 30% da carga horária do curso concluída e 40% no semestre de realização intercâmbio. O Programa não contempla auxílio financeiro para os estudantes, mas implica na isenção de taxas acadêmicas na instituição de destino.";

it("conta um edital AUGM e mantém destino desconhecido apesar de vários países e endereço da UFSC", () => {
  const item = normalizeUfscExchange({ text: augmText, url: UFSC_AUGM_URL, source: augm }, now)!;
  expect(item).toMatchObject({ deadlineAt: "2026-10-21", applicantType: "undergraduate_student", categories: ["bolsas", "intercambios"], stateCode: null, cityName: null, countryCode: null });
  expect(item.requirementsText).toContain("11 vagas");
  expect(publicationIssue(item, augm, now)).toBeNull();
  expect(normalizeUfscExchange({ text: augmText.replace("nível B1", "nível não informado"), url: UFSC_AUGM_URL, source: augm }, now)).toBeNull();
});

it("usa a janela Outgoing 2027.1 atravessando o rodapé PDF, sem prometer bolsa ou multiplicar destinos", () => {
  const item = normalizeUfscExchange({ text: outgoingText, url: UFSC_OUTGOING_URL, source: outgoing }, now)!;
  expect(item).toMatchObject({ deadlineAt: "2026-11-15", categories: ["intercambios"], benefitType: "other", countryCode: null, stateCode: null, cityName: null });
  expect(item.amountText).toContain("não oferece auxílio financeiro");
  expect(item.requirementsText).toContain("pode ser anterior");
  expect(publicationIssue(item, outgoing, now)).toBeNull();
  expect(normalizeUfscExchange({ text: outgoingText.replace("(Intercâmbio em 2027.1)", "(Intercâmbio em 2026.2)"), url: UFSC_OUTGOING_URL, source: outgoing }, now)).toBeNull();
});
