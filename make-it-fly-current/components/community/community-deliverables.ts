import { COMMUNITY_BENEFITS_TERMS } from "@/content/community-offer";

/** Public sales copy. Availability is explicit; this does not grant product access. */
export const COMMUNITY_SALES_DELIVERABLES = [
  { id: "radar", label: "Radar de oportunidades", fact: "Comece gratuitamente", title: "Encontre seu próximo passo.", description: "Eventos, bolsas, editais, programas e carreira, com requisitos, prazos e fontes oficiais. A entrada gratuita permite consultar até 10 eventos distintos por conta.", href: "#radar", action: "Conhecer o Radar" },
  { id: "ferramentas", label: "Caixa de Ferramentas", fact: "Disponível · assinatura anual", title: "Escolha a ferramenta para sua tarefa.", description: "Catálogo curado por categoria, com descrição breve e links oficiais, disponível na área de membros para assinantes anuais com acesso vigente.", href: "#ferramentas", action: "Conhecer a caixa" },
  { id: "perks", label: "Benefícios", fact: "Condições por oferta", title: "Encontre ofertas de parceiros.", description: COMMUNITY_BENEFITS_TERMS, href: "#perks", action: "Entender os benefícios" },
  { id: "learn", label: "Trilha de IA aplicada", fact: "Lançamento inicial parcial", title: "Aprenda fazendo.", description: "Comece por “Um primeiro resultado com IA”: três atividades para escolher uma tarefa, preparar um pedido e conferir o resultado. Os próximos módulos estão em preparação.", href: "#learn", action: "Conhecer a trilha" },
] as const;
