import type { SurveyDefinition } from "./contract";

export const codexWorkshopSurvey: SurveyDefinition = {
  title: "Pesquisa do Codex Community Workshop de Florianópolis",
  slug: "codex-florianopolis",
  intro: "Queremos saber o que funcionou no workshop, o que melhorar no próximo encontro e o que você gostaria de fazer com IA. Sua participação é voluntária.",
  purpose: "avaliar o workshop e melhorar os próximos eventos e a Trilha de Aprendizagem",
  retentionDays: null,
  status: "draft",
  collaboration: true,
  radar: true,
  questions: [
    { id: "nota", label: "De 0 a 10, quanto o workshop atendeu às suas expectativas? (0 = não atendeu. 10 = atendeu totalmente.)", kind: "score", required: true },
    { id: "motivo", label: "O que mais pesou na sua nota?", kind: "text", required: false },
    { id: "melhoria", label: "Se pudéssemos mudar uma coisa no próximo evento, o que você mudaria?", kind: "text", required: false },
    { id: "tarefa", label: "Qual tarefa real você gostaria de conseguir fazer com IA na próxima semana?", kind: "text", required: true },
    {
      id: "obstaculo", label: "O que mais dificulta fazer essa tarefa hoje?", kind: "choice", required: true,
      options: [
        "Saber por onde começar.", "Acessar ou configurar a ferramenta.", "Explicar à IA o que eu preciso.",
        "Conferir e corrigir o resultado.", "Encontrar tempo para praticar.", "Nada me impede.", "Outro.",
      ],
    },
  ],
};

export const blankSurvey: SurveyDefinition = {
  title: "", slug: "", intro: "", purpose: "", retentionDays: null, status: "draft",
  collaboration: false, radar: false,
  questions: [{ id: "pergunta-1", label: "", kind: "text", required: false }],
};
