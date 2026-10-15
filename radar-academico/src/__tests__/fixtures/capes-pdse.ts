import { PDSE_SOURCE_ID, PDSE_URL, PDSE_NEWS_URL } from "@/lib/ingestion/normalize-capes-pdse";
import type { OfficialSource } from "@/lib/ingestion/types";
export const pdseSource: OfficialSource = { id: PDSE_SOURCE_ID, name: "CAPES PDSE", institutionName: "CAPES", institutionAcronym: "CAPES", sourceType: "government_foundation",
  baseUrl: PDSE_URL, listingUrls: [PDSE_URL], allowedDomains: ["www.gov.br"], allowedPathPrefixes: [new URL(PDSE_URL).pathname, new URL(PDSE_NEWS_URL).pathname],
  extractionMode: "html", audienceScope: ["postgraduate_student"], geographicScope: [], categories: ["bolsas", "intercambios", "pesquisa"], priority: 80, active: true };
export const pdseProgramme = `<div id="page-document"><h1>Programa de Doutorado-sanduíche no Exterior (PDSE)</h1>
 <p>cursos de Doutorado reconhecidos pela CAPES.</p>
 <p>Benefícios: Mensalidade Auxílio deslocamento Auxílio instalação Auxílio seguro-saúde Adicional localidade, quando for o caso.
 Duração: mínimo 4 (quatro) meses e no máximo 9 (nove) meses</p>
 <p>A IES fará seleção e, se aprovado, o candidato deverá fazer a inscrição online no site da CAPES, homologada pela Pró-Reitoria.</p>
 <table><tr><td>Seleção interna (nas IES) dos candidatos</td><td>Até o dia 16 de outubro de 2026</td><td>IES</td></tr>
 <tr><td>Inscrição das candidaturas no sistema da CAPES incluindo preenchimento do formulário</td><td>De 20 de outubro a 18 de novembro de 2026 até às 17h (horário de Brasília)</td><td>Candidato</td></tr>
 <tr><td>Início das atividades no exterior</td><td>Setembro e outubro de 2027</td></tr></table>
 <p>Documentos vigentes</p><a href="/capes/edital.pdf">Edital nº 22/2026 - Programa Institucional de Doutorado Sanduíche no Exterior</a></div>`;
export const pdseNews = `<div id="page-document"><h1>Doutorado Sanduíche no Exterior tem prazos e critérios de seleção alterados</h1>
 <p>Alteração no Edital nº 22/2026. Seleção interna pelas IES: até 16 de outubro de 2026.</p>
 <p>Inscrição e envio de documentos no sistema da CAPES: de 20 de outubro a 18 de novembro de 2026, até as 17h (horário de Brasília).
 As demais regras e condições do Edital nº 22/2026 permanecem inalteradas.</p></div>`;
