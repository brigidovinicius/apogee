import { expect, it } from "vitest";
import { normalizeSenacPsgCourses, SENAC_PSG_URL } from "@/lib/ingestion/normalize-senac-psg";
import { canonicalOpportunityKey } from "@/lib/ingestion/revision-key";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "senac-sc-psg-open-cohorts", name: "Senac PSG", institutionName: "Senac Santa Catarina", institutionAcronym: "Senac SC",
  sourceType: "official_reference", baseUrl: SENAC_PSG_URL, allowedDomains: ["portal.sc.senac.br"],
  allowedPathPrefixes: ["/cursos-gratuitos"], listingUrls: [SENAC_PSG_URL], extractionMode: "html",
  audienceScope: ["mixed"], geographicScope: ["Santa Catarina"], categories: ["formacao"], priority: 80, active: true,
};
const now = new Date("2026-10-14T15:00:00Z");
const cohort = {
  id: 228907, planoDoCursoId: 160704, estadoDescricao: "Liberado Para Matrícula", divulgacaoOnline: true,
  localidade: "Rio do Sul", nomeUnidadeOperativa: "SENAC - CEP RIO DO SUL", formaDeExecucao: "Presencial",
  dataPeriodoExecucaoInicial: "2026-10-19T00:00:00", dataPeriodoExecucaoFinal: "2026-11-23T00:00:00",
  dataDeEncerramentoPresencial: "2026-10-20T00:00:00", preco: 500, vagasDisponiveis: 30,
  recursosFinanceiros: [{ nome: "PSG", tipoDeRecursoNome: "Gratuito", vagasDisponiveis: 8 },
    { nome: "Comercial", tipoDeRecursoNome: "Comercial", vagasDisponiveis: 22 }],
};
const course = {
  titulo: "Fundamentos do Python I", planoDoCursoId: 160704, permitirPublicarInternet: true, matriculasAbertas: true,
  estadoDoPlanoDoCurso: "Disponivel", requisitos: [{ requisitos: ["Idade maior ou igual a 15 anos.", "Comprovante de Escolaridade"] }],
  turmasLiberadasParaMatricula: [cohort],
};
const html = (courses: unknown) => `<body><h1>Programa Senac de Gratuidade</h1><p>100% GRATUITO PSG</p>
<p>Cursos para pessoas com renda familiar mensal per capita de até 2 salários mínimos</p>
<script>window.cursosData = ${JSON.stringify(courses)};</script></body>`;

it("publica a turma com vagas PSG, prazo, renda e requisitos, sem confundir preço comercial com gratuidade", () => {
  const [item] = normalizeSenacPsgCourses(html([course]), source, now);
  expect(item).toMatchObject({ deadlineAt: "2026-10-20", deadlinePrecision: "date_only", countryCode: "BR", stateCode: "SC", cityName: "Rio do Sul", opportunityStatus: "open", categories: ["formacao"] });
  expect(item.amountText).toContain("Curso gratuito");
  expect(item.amountText).not.toContain("500");
  expect(item.requirementsText).toContain("15 anos");
  expect(item.requirementsText).toContain("per capita de até 2 salários mínimos");
  expect(item.requirementsText).toContain("Registrar interesse não garante");
  expect(publicationIssue(item, source, now)).toBeNull();
});

it("conta curso/cidade/início uma vez, reúne turnos e conserva o primeiro prazo das ofertas paralelas", () => {
  const items = normalizeSenacPsgCourses(html([course, { ...course, planoDoCursoId: 160705,
    requisitos: [{ requisitos: ["Conhecimento específico adicional"] }], turmasLiberadasParaMatricula: [
      { ...cohort, id: 228908, planoDoCursoId: 160705, dataDeEncerramentoPresencial: "2026-10-18T00:00:00" },
    ] }]), source, now);
  expect(items).toHaveLength(1);
  expect(items[0].deadlineAt).toBe("2026-10-18");
  expect(items[0].requirementsText).toContain("Oferta paralela");
  expect(items[0].requirementsText).toContain("Conhecimento específico adicional");
});

it("mantém edições distintas e a identidade quando as vagas variam", () => {
  const items = normalizeSenacPsgCourses(html([{ ...course, turmasLiberadasParaMatricula: [cohort,
    { ...cohort, id: 228908, dataPeriodoExecucaoInicial: "2026-10-21T00:00:00" },
  ] }]), source, now);
  expect(items).toHaveLength(2);
  const key = (title: string) => canonicalOpportunityKey(source.id, title, SENAC_PSG_URL);
  expect(key(items[0].title)).not.toBe(key(items[1].title));
  const changed = normalizeSenacPsgCourses(html([{ ...course, turmasLiberadasParaMatricula: [{ ...cohort,
    recursosFinanceiros: [{ nome: "PSG", tipoDeRecursoNome: "Gratuito", vagasDisponiveis: 2 }],
  }] }]), source, now);
  expect(key(changed[0].title)).toBe(key(items[0].title));
  expect(changed[0].contentHash).not.toBe(items[0].contentHash);
});

it.each([
  { recursosFinanceiros: [{ nome: "PSG", tipoDeRecursoNome: "Gratuito", vagasDisponiveis: 0 }, { nome: "Comercial", tipoDeRecursoNome: "Comercial", vagasDisponiveis: 20 }] },
  { dataDeEncerramentoPresencial: "2026-10-13T00:00:00" },
  { dataDeEncerramentoPresencial: "2026-02-30T00:00:00" },
  { dataDeEncerramentoPresencial: null },
  { estadoDescricao: "Planejado" },
  { divulgacaoOnline: false },
])("não publica vagas pagas, encerradas ou sem confirmação: %j", (change) => {
  expect(normalizeSenacPsgCourses(html([{ ...course, turmasLiberadasParaMatricula: [{ ...cohort, ...change }] }]), source, now)).toEqual([]);
});

it("não conta interesse em curso sem turma nem formação condicionada a contrato como vaga de emprego", () => {
  expect(normalizeSenacPsgCourses(html([{ ...course, turmasLiberadasParaMatricula: [] }]), source, now)).toEqual([]);
  expect(normalizeSenacPsgCourses(html([{ ...course, matriculasAbertas: false }]), source, now)).toEqual([]);
  expect(normalizeSenacPsgCourses(html([{ ...course, requisitos: [{ requisitos: ["Contrato de Trabalho da Aprendizagem"] }] }]), source, now)).toEqual([]);
});

it("distingue catálogo vazio válido de página indisponível e nunca executa scripts", () => {
  expect(normalizeSenacPsgCourses(html([]), source, now)).toEqual([]);
  expect(() => normalizeSenacPsgCourses("<body>Manutenção</body>", source, now)).toThrow();
  expect(() => normalizeSenacPsgCourses(html([]).replace("window.cursosData = []", "window.cursosData = dangerousCall()"), source, now)).toThrow();
  expect(() => normalizeSenacPsgCourses(html([]).replace("[];", "[{broken}];"), source, now)).toThrow();
});
