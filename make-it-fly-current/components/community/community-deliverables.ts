import { COMMUNITY_BENEFITS_REDEMPTION } from "@/content/community-offer";

export const COMMUNITY_SALES_DELIVERABLES = [
  {
    id: "ferramentas", label: "Caixa de Ferramentas", fact: "Assinatura anual",
    title: "Ferramentas para sua próxima ideia.",
    description: "Escolha por tarefa e acesse o site oficial. Licenças e créditos seguem as condições de cada fornecedor.",
    href: "#ferramentas", action: "Conhecer a Caixa de Ferramentas",
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
    description: "Agenda e fotos dos encontros. Consulte as condições de cada evento.",
    href: "#participar", action: "Ver eventos presenciais",
  },
] as const;

export type PublishedResources = { ferramentas: boolean };

export function availableDeliverables(resources: PublishedResources) {
  return COMMUNITY_SALES_DELIVERABLES.filter(item => item.id !== "ferramentas" || resources.ferramentas);
}
