import { COMMUNITY_BENEFITS_REDEMPTION } from "@/content/community-offer";

export const COMMUNITY_SALES_DELIVERABLES = [
  {
    id: "ferramentas", label: "Caixa de Ferramentas", fact: "Assinatura anual",
    title: "Ferramentas para sua próxima ideia.",
    description: "Escolha por tarefa e acesse o site oficial. Licenças e créditos seguem as condições de cada fornecedor.",
    href: "#ferramentas", action: "Conhecer a Caixa de Ferramentas",
  },
  {
    id: "learn", label: "Trilha de IA", fact: "Assinatura anual",
    title: "Seu primeiro resultado com IA.",
    description: "Três atividades: escolha uma tarefa, crie seu pedido e revise o resultado. Próximos módulos em preparação.",
    href: "#learn", action: "Conhecer a trilha",
  },
  {
    id: "radar", label: "Radar de oportunidades",
    title: "Oportunidades com prazos e fontes.",
    description: "Eventos, bolsas, editais e vagas. A assinatura dá acesso ao Radar completo.",
    href: "#radar", action: "Conhecer o Radar",
  },
  {
    id: "perks", label: "Benefícios",
    title: "Ofertas de parceiros para você.",
    description: COMMUNITY_BENEFITS_REDEMPTION,
    href: "#perks", action: "Entender os benefícios",
  },
  {
    id: "encontros", label: "Eventos presenciais", fact: "Condições por evento",
    title: "Encontre a comunidade pessoalmente.",
    description: "Conheça a agenda e as fotos dos encontros. Inscrições e condições são definidas por evento.",
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
