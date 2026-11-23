import type { SurveyDefinition } from "./contract";

export const codexWorkshopSurvey: SurveyDefinition = {
  title: "Pesquisa do Codex Community Workshop de Florianópolis",
  slug: "codex-florianopolis",
  intro: "Queremos saber o que funcionou no workshop, o que melhorar no próximo encontro e o que você gostaria de fazer com IA. Sua participação é voluntária.",
  purpose: "avaliar o evento, melhorar os próximos encontros e a Trilha de Aprendizagem e entender o interesse em novidades da Apogee",
  retentionDays: 90,
  status: "draft",
  collaboration: false,
  radar: true,
  questions: [
    { id: "nota", label: "De 0 a 10, quanto o evento atendeu às suas expectativas? (0 = não atendeu. 10 = atendeu totalmente.)", kind: "score", required: true },
    { id: "motivo", label: "O que mais pesou na sua nota?", kind: "text", required: false },
    {
      id: "melhoria", label: "Se pudesse mudar alguma coisa no próximo evento, o que você mudaria?",
      hint: "Você pode comentar sobre os momentos de convivência, a comida, o local ou outro aspecto do evento.",
      kind: "text", required: false,
    },
    {
      id: "tarefa", label: "Que tarefas você gostaria de aprender a fazer com inteligência artificial?",
      kind: "text", required: true, noneOption: "Nenhuma",
    },
    {
      id: "obstaculo", label: "O que mais te impede de fazer isso hoje?", kind: "choice", required: true, skipIfNone: "tarefa",
      options: [
        "Saber por onde começar.", "Acessar ou configurar a ferramenta.", "Explicar à IA o que eu preciso.",
        "Conferir e corrigir o resultado.", "Encontrar tempo para praticar.", "Outro", "Nada me impede.",
      ],
    },
    {
      id: "atualizacoes", label: "Você gostaria de receber mais atualizações sobre a Apogee?",
      hint: "Sua resposta ajuda a entender o interesse em receber novidades.",
      kind: "choice", required: true, options: ["Sim", "Não"],
    },
  ],
};

export const blankSurvey: SurveyDefinition = {
  title: "", slug: "", intro: "", purpose: "", retentionDays: null, status: "draft",
  collaboration: false, radar: false,
  questions: [{ id: "pergunta-1", label: "", kind: "text", required: false }],
};
