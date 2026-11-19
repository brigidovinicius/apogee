import { COMMUNITY_BENEFITS_TERMS } from "@/content/community-offer";

export const COMMUNITY_SALES_DELIVERABLES = [
  {
    id: "ferramentas", label: "Caixa de Ferramentas", fact: "Assinatura anual",
    title: "Escolha uma ferramenta para criar um vídeo, pesquisar ou escrever.",
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
    id: "radar", label: "Radar de oportunidades", fact: "Acesso gratuito e anual",
    title: "Encontre um evento e veja como participar.",
    description: "Consulte gratuitamente os detalhes de até 10 eventos distintos por conta. A assinatura anual inclui o Radar completo, com eventos, bolsas, editais e outras oportunidades.",
    href: "#radar", action: "Conhecer o Radar",
  },
  {
    id: "perks", label: "Benefícios", fact: "Assinatura anual",
    title: "Confira quais ofertas de parceiros você pode usar.",
    description: COMMUNITY_BENEFITS_TERMS,
    href: "#perks", action: "Entender os benefícios",
  },
] as const;
