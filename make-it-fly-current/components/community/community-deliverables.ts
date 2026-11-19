import { COMMUNITY_BENEFITS_TERMS } from "@/content/community-offer";

export const COMMUNITY_SALES_DELIVERABLES = [
  {
    id: "ferramentas", label: "Caixa de Ferramentas", fact: "Assinatura anual",
    title: "Encontre ferramentas para te ajudar no seu objetivo.",
    description: "Compare as opções por categoria e abra o site oficial de cada ferramenta. Contas, licenças e créditos seguem as condições do fornecedor.",
    href: "#ferramentas", action: "Conhecer a Caixa de Ferramentas",
  },
  {
    id: "learn", label: "Trilha de IA", fact: "Assinatura anual",
    title: "Use IA em uma tarefa sua, do primeiro pedido à revisão.",
    description: "O exercício inicial tem três atividades. Você escolhe uma tarefa, escreve um pedido e confere se o resultado atende aos seus critérios. Os próximos módulos estão em preparação.",
    href: "#learn", action: "Conhecer a trilha",
  },
  {
    id: "radar", label: "Radar de oportunidades", fact: "10 consultas mensais na conta gratuita",
    title: "Encontre um evento e veja como participar.",
    description: "Consulte gratuitamente os detalhes de até 10 oportunidades por mês. A assinatura anual inclui o Radar completo, com eventos, bolsas, editais e outras oportunidades.",
    href: "#radar", action: "Conhecer o Radar",
  },
  {
    id: "perks", label: "Benefícios", fact: "10 consultas mensais na conta gratuita",
    title: "Confira quais ofertas de parceiros você pode usar.",
    description: COMMUNITY_BENEFITS_TERMS,
    href: "#perks", action: "Entender os benefícios",
  },
  {
    id: "encontros", label: "Eventos presenciais", fact: "Condições por evento",
    title: "Conheça os encontros da Apogee e veja como participar.",
    description: "Veja como participar do workshop em Florianópolis ou visite a galeria do Make It Fly. Cada encontro tem suas próprias condições de participação.",
    href: "#participar", action: "Ver eventos presenciais",
  },
] as const;

export type PublishedResources = { trilha: boolean; ferramentas: boolean };

export function availableDeliverables(resources: PublishedResources) {
  return COMMUNITY_SALES_DELIVERABLES.filter(item => {
    if (item.id === "learn") return resources.trilha;
    if (item.id === "ferramentas") return resources.ferramentas;
    return true;
  });
}
