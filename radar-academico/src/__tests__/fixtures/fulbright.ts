import { FULBRIGHT_SOURCE_ID, FULBRIGHT_URL } from "@/lib/ingestion/normalize-fulbright";
import type { OfficialSource } from "@/lib/ingestion/types";
export const fulbrightSource: OfficialSource = {
  id: FULBRIGHT_SOURCE_ID, name: "Fulbright", institutionName: "Comissão Fulbright Brasil", institutionAcronym: "Fulbright",
  sourceType: "official_reference", baseUrl: FULBRIGHT_URL, listingUrls: [FULBRIGHT_URL],
  allowedDomains: ["fulbright.org.br"], allowedPathPrefixes: [new URL(FULBRIGHT_URL).pathname],
  extractionMode: "html", audienceScope: ["researcher"], geographicScope: [], categories: ["bolsas", "intercambios", "pesquisa"], priority: 75, active: true,
};
// Abbreviated fixture: no form is submitted and no external application URL is fetched.
export const fulbrightHtml = `<article><h2>Cátedra Dra. Ruth Cardoso na Georgetown University</h2>
  <p>Comissão Fulbright. Inscrições abertas até15 de novembro de 2026</p>
  <h2>Requisitos</h2><p>Possuir nacionalidade brasileira e não ter nacionalidade norte-americana;
  doutorado até 30 de julho de 2016; fluência em inglês;
  Permanecer no Brasil durante a seleção, afiliação e partida aos EUA.</p>
  <h3>Benefícios</h3><p>Estipêndio para 1 ou 2 semestres acadêmicos: US$ 32.100,00. Seguro.</p>
  <h2>Atenção:</h2><a href="https://fulbright.org.br/wp-content/uploads/2020/12/Call-Dr.-Ruth-Cardoso-at-Georgetown-University.pdf">Leia o edital</a>
  <a href="https://apply.iie.org/fvsp2027">Inscreva-se</a></article>`;
