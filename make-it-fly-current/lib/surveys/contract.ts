import { z } from "zod";

export const surveySlug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80);
export const surveyStatuses = ["draft", "open", "closed"] as const;
export const surveyStatusLabels = { draft: "Rascunho", open: "Recebendo respostas", closed: "Encerrada" };
export const collaborationOptions = ["exercise", "event", "project"] as const;
export const collaborationLabels = {
  exercise: "Testar um exercício da Trilha",
  event: "Ajudar a testar o formato de um evento",
  project: "Conversar com a equipe sobre um projeto",
};
export const radarNotice = "O piloto mede visualizações da lista, aberturas de oportunidades, salvamentos na agenda e cliques em links oficiais. A Apogee enviará ao Amplitude o tipo, o horário e o identificador de cada evento, junto com um código que representa sua conta. Os eventos ficam no projeto europeu por três meses. A medição só começa após confirmação nas preferências da conta, onde você também pode revogar a permissão.";
export const collaborationNotice = "Se você escolher colaborar, a Apogee usará seu e-mail para enviar um convite sobre essa atividade.";

const questionId = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/);
const questionBase = {
  id: questionId,
  label: z.string().trim().min(1).max(220),
  required: z.boolean(),
  hint: z.string().trim().min(1).max(240).optional(),
  skipIfNone: questionId.optional(),
};
const question = z.discriminatedUnion("kind", [
  z.strictObject({ ...questionBase, kind: z.literal("score") }),
  z.strictObject({ ...questionBase, kind: z.literal("text"), noneOption: z.string().trim().min(1).max(80).optional() }),
  z.strictObject({
    ...questionBase, kind: z.literal("choice"),
    options: z.array(z.string().trim().min(1).max(140)).min(2).max(12)
      .refine(options => new Set(options).size === options.length, "Evite opções duplicadas."),
  }),
]);
export const surveyDefinition = z.strictObject({
  title: z.string().trim().min(3).max(140),
  slug: surveySlug,
  intro: z.string().trim().max(1000),
  purpose: z.string().trim().min(8).max(300),
  retentionDays: z.number().int().min(1).max(730).nullable(),
  status: z.enum(surveyStatuses),
  questions: z.array(question).min(1).max(12).refine(items => new Set(items.map(item => item.id)).size === items.length),
  collaboration: z.boolean(),
  radar: z.boolean(),
}).refine(value => value.status !== "open" || value.retentionDays !== null, {
  path: ["retentionDays"], message: "Informe o prazo de retenção para abrir a pesquisa.",
}).refine(({ questions }) => questions.every((item, index) =>
  !item.skipIfNone || questions.slice(0, index).some(source =>
    source.id === item.skipIfNone && source.kind === "text" && source.noneOption,
  ),
), {
  path: ["questions"], message: "Selecione uma pergunta aberta anterior com opção para nenhuma resposta.",
});

export type SurveyDefinition = z.infer<typeof surveyDefinition>;
export type SurveyQuestion = z.infer<typeof question>;
export type Survey = SurveyDefinition & { id: string; revision: number };

export const surveyInactivityMinutes = 30;
export const surveyQuestionStage = (id: string) => `pergunta:${id}`;

export function surveyStages(survey: Pick<SurveyDefinition, "questions" | "collaboration" | "radar">) {
  return [
    { id: "inicio", label: "Início após a autorização" },
    ...survey.questions.map((item, index) => ({ id: surveyQuestionStage(item.id), label: `${index + 1}. ${item.label}` })),
    ...(survey.collaboration ? [{ id: "colaboracao", label: "Convite para colaborar" }] : []),
    ...(survey.radar ? [{ id: "radar", label: "Escolha sobre a medição do Radar" }] : []),
    { id: "envio", label: "Envio das respostas" },
  ];
}

export function visibleSurveyQuestions(questions: SurveyQuestion[], hasSelectedNone: (id: string) => boolean) {
  const selectedNone = new Set<string>();
  return questions.filter(item => {
    if (item.skipIfNone && selectedNone.has(item.skipIfNone)) return false;
    if (item.kind === "text" && item.noneOption && hasSelectedNone(item.id)) selectedNone.add(item.id);
    return true;
  });
}

export function researchNotice(survey: Pick<SurveyDefinition, "purpose" | "retentionDays">) {
  const retention = survey.retentionDays === null ? "Prazo de retenção a definir." : `As respostas e os registros de progresso serão guardados na Apogee por ${survey.retentionDays} ${survey.retentionDays === 1 ? "dia" : "dias"}.`;
  return `A Apogee usará suas respostas para ${survey.purpose}. Ao autorizar, a Apogee também registra as etapas visitadas para entender onde o preenchimento é interrompido, mesmo sem envio. Esse registro de progresso usa um código de tentativa, sem nome, e-mail ou conteúdo das respostas. ${retention} A equipe da Apogee terá acesso às respostas e ao progresso agregado. Para revogar a autorização ou solicitar acesso, correção ou exclusão, escreva para contato@apogee.community.`;
}

export const surveySubmissionVersion = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
});

const progressIdentity = { id: z.uuid(), revision: z.number().int().positive() };
export const surveyProgressEvent = z.discriminatedUnion("kind", [
  z.strictObject({ ...progressIdentity, kind: z.literal("stage"), stage: z.string().max(80), sequence: z.number().int().min(1).max(100_000) }),
  z.strictObject({ ...progressIdentity, kind: z.literal("withdraw") }),
]);

const submission = z.strictObject({
  ...surveySubmissionVersion.shape,
  research: z.boolean(),
  answers: z.record(z.string(), z.union([z.string().trim().max(1000), z.number().int(), z.null()])),
  collaboration: z.enum(collaborationOptions).nullable(),
  email: z.email().max(254).nullable(),
  radar: z.enum(["allow", "deny"]).nullable(),
  attempt: z.uuid().optional(),
});

export function validateSurveySubmission(survey: SurveyDefinition, input: unknown) {
  const result = submission.safeParse(input);
  if (!result.success) return null;
  const data = result.data;
  if (data.radar !== null && !survey.radar) return null;
  if (!data.research && (Object.keys(data.answers).length || data.collaboration || data.email || data.radar === null || data.attempt)) return null;
  if (data.collaboration && (!survey.collaboration || !data.email) || data.email && !data.collaboration) return null;

  const visible = visibleSurveyQuestions(survey.questions, id => data.answers[id] === null);
  const questions = new Map(visible.map(item => [item.id, item]));
  const answers: [string, string | number][] = [];
  for (const [id, answer] of Object.entries(data.answers)) {
    const item = questions.get(id);
    if (!item) return null;
    const value = answer === null && item.kind === "text" ? item.noneOption : answer;
    if (value == null) return null;
    if (item.kind === "score" && (typeof value !== "number" || value < 0 || value > 10)) return null;
    if (item.kind === "text" && (typeof value !== "string" || !value)) return null;
    if (item.kind === "choice" && (typeof value !== "string" || !item.options.includes(value))) return null;
    answers.push([id, value]);
  }
  if (data.research && visible.some(item => item.required && !Object.hasOwn(data.answers, item.id))) return null;
  return { ...data, answers: Object.fromEntries(answers) };
}
