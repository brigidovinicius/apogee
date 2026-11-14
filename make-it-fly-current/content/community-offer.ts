export const RADAR_FREE_EVENT_LIMIT = 10;
export const COMMUNITY_SIGNUP_PATH = "/membros/cadastro?next=%2Fmembros%2Foportunidades";
export const RADAR_FREE_NOTE = "Consulte gratuitamente até 10 eventos distintos por conta. Reabrir o mesmo evento não gasta outra consulta. O Radar completo está incluído na assinatura da comunidade.";

export const COMMUNITY_PILLARS = [
  { kind: "radar", name: "Apogee Radar", title: "Encontre seu próximo passo.", status: "Comece gratuitamente", description: "Eventos, bolsas, editais, programas e carreira, com requisitos, prazos e fontes oficiais.", href: "/oportunidades", action: "Explorar o Radar" },
  { kind: "learn", name: "Apogee Learn", title: "Aprenda fazendo.", status: "Trilhas do plano", description: "IA aplicada à escrita, à rotina e aos projetos. Trilhas curtas com um resultado concreto para colocar em prática.", href: "#learn", action: "Conhecer as trilhas" },
  { kind: "perks", name: "Apogee Perks", title: "Mais possibilidades para experimentar.", status: "Conforme disponibilidade", description: "Créditos, testes e descontos em ferramentas parceiras, conforme os acordos, a elegibilidade e as regras de cada oferta.", href: "#perks", action: "Entender os benefícios" },
  { kind: "community", name: "Apogee Community", title: "Construa com outras pessoas.", status: "Conexões e experiências", description: "Trocas, projetos, desafios e encontros para continuar aprendendo. Consulte a agenda e as condições de cada atividade.", href: "#participar", action: "Encontrar seu caminho" },
] as const;
