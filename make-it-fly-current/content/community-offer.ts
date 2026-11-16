export const RADAR_FREE_EVENT_LIMIT = 10;
export const COMMUNITY_SIGNUP_PATH = "/membros/cadastro?next=%2Fmembros%2Foportunidades";
export const RADAR_FREE_NOTE = "Consulte gratuitamente até 10 eventos distintos por conta. Reabrir o mesmo evento não gasta outra consulta. O Radar completo está incluído na assinatura da comunidade.";

export const COMMUNITY_PILLARS = [
  { kind: "radar", name: "Apogee Radar", title: "Encontre seu próximo passo.", status: "Comece gratuitamente", description: "Eventos, bolsas, editais, programas e carreira, com requisitos, prazos e fontes oficiais.", href: "/oportunidades", action: "Explorar o Radar" },
  { kind: "learn", name: "Apogee Learn", title: "Aprenda fazendo.", status: "Trilha inicial parcial", description: "Um primeiro resultado com IA: três atividades para escolher uma tarefa, preparar um pedido e conferir o resultado. Próximos módulos em preparação.", href: "#learn", action: "Conhecer a trilha" },
  { kind: "perks", name: "Apogee Perks", title: "Mais possibilidades para experimentar.", status: "Em preparação", description: "Sem benefícios de parceiros disponíveis neste lançamento. Novas ofertas dependem de acordos confirmados, disponibilidade e condições próprias.", href: "#perks", action: "Entender os benefícios" },
  { kind: "community", name: "Apogee Community", title: "Construa com outras pessoas.", status: "Conexões e experiências", description: "Trocas, projetos, desafios e encontros para continuar aprendendo. Consulte a agenda e as condições de cada atividade.", href: "#participar", action: "Encontrar seu caminho" },
] as const;
