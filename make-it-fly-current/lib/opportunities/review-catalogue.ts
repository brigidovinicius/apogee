import type { StudentOpportunity } from "./types";
// Synthetic records for explicit local development review. No real event or registration is represented.
export const REVIEW_EVENTS: StudentOpportunity[] = Array.from({length:12},(_,i)=>({
  id:`radar-review-event-${i+1}`,title:`Evento de validação ${String(i+1).padStart(2,"0")}`,
  organization:"Apogee · dados de teste local",kind:"Programa",categories:["eventos"],level:"Público diverso",
  location:"Brasil",stateCode:null,cityName:null,summary:"Evento fictício para validar o acesso por conta.",
  benefit:"Experiência de teste",eligibility:"Detalhe protegido: este conteúdo foi liberado pela regra real do servidor.",
  deadline:"2099-12-31",deadlineLabel:"Data fictícia de teste",verifiedAt:"2026-11-14",
  officialUrl:"https://example.com/apogee-local-review",financials:{benefits:[],costs:[],notes:["Sem inscrição, atividade ou cobrança real."]},
}));
