import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { codexWorkshopSurvey } = load("lib/surveys/templates.ts");
const { researchNotice, surveyDefinition, surveyIdentityNoticeVersion, surveyProgressEvent, surveyStages, validateSurveySubmission } = load("lib/surveys/contract.ts");
const valid = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  research: true,
  answers: { nota: 0, tarefa: "Revisar uma apresentação sintética", obstaculo: "Conferir e corrigir o resultado.", atualizacoes: "Não" },
  collaboration: null,
  email: null,
  radar: null,
};

test("the workshop template is a draft with its approved retention and opening requires a retention period", () => {
  assert.equal(surveyDefinition.safeParse(codexWorkshopSurvey).success, true);
  assert.equal(codexWorkshopSurvey.status, "draft");
  assert.equal(codexWorkshopSurvey.retentionDays, 90);
  assert.equal(surveyDefinition.safeParse({ ...codexWorkshopSurvey, status: "open", retentionDays: null }).success, false);
  assert.equal(surveyDefinition.safeParse({ ...codexWorkshopSurvey, status: "open" }).success, true);
});

test("zero is a valid rating and answers must match the saved fields", () => {
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, valid).answers.nota, 0);
  for (const answers of [
    { ...valid.answers, nota: 11 },
    { ...valid.answers, nota: "0" },
    { ...valid.answers, obstaculo: "Opção de outra versão" },
    { ...valid.answers, desconhecida: "valor fora da pesquisa" },
    { ...valid.answers, tarefa: " " },
    { ...valid.answers, atualizacoes: "Talvez" },
    { ...valid.answers, motivo: null },
  ]) assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers }), null);
});

test("the explicit None choice skips the obstacle and is saved under its displayed label", () => {
  const { obstaculo, ...remaining } = valid.answers;
  const answers = { ...remaining, tarefa: null };
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers }).answers.tarefa, "Nenhuma");
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers: { ...answers, obstaculo } }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers: remaining }), null);
  assert.ok(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers: { ...valid.answers, tarefa: "Nenhuma por enquanto" } }));
});

test("conditional questions must refer to an earlier question offering None", () => {
  const questions = [...codexWorkshopSurvey.questions].reverse();
  assert.equal(surveyDefinition.safeParse({ ...codexWorkshopSurvey, questions }).success, false);
});

test("research, the invitation and the Radar choice are independent", () => {
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, email: "fixture@example.test" }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, collaboration: "exercise" }), null);
  const invitation = { ...valid, collaboration: "exercise", email: "fixture@example.test" };
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, invitation), null);
  assert.ok(validateSurveySubmission({ ...codexWorkshopSurvey, collaboration: true }, invitation));
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, radar: "allow" }), null);
  assert.ok(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, answers: {}, radar: "deny" }));
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, answers: {} }), null);
  assert.equal(validateSurveySubmission({ ...codexWorkshopSurvey, radar: false }, { ...valid, radar: "allow" }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, accountId: "fixture" }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, answers: {}, radar: "deny", attempt: valid.id }), null);
});

test("survey progress carries a stage but rejects response content and identifiers", () => {
  const event = { kind: "stage", id: valid.id, revision: 1, stage: "pergunta:nota", sequence: 1 };
  assert.ok(surveyProgressEvent.safeParse(event).success);
  assert.equal(surveyProgressEvent.safeParse({ ...event, email: "fixture@example.test" }).success, false);
  assert.equal(surveyProgressEvent.safeParse({ ...event, answers: {} }).success, false);
  assert.equal(surveyProgressEvent.safeParse({ ...event, identityNoticeVersion: surveyIdentityNoticeVersion }).success, false);
  assert.deepEqual(surveyStages(codexWorkshopSurvey).map(item => item.id), [
    "inicio", "pergunta:nota", "pergunta:motivo", "pergunta:melhoria", "pergunta:tarefa",
    "pergunta:obstaculo", "pergunta:atualizacoes", "radar", "envio",
  ]);
  assert.match(researchNotice({ ...codexWorkshopSurvey, retentionDays: 90 }), /etapas visitadas.*mesmo sem envio.*90 dias/);
});

test("identity is disclosed for research submissions and never accompanies a Radar-only choice", () => {
  assert.match(researchNotice(codexWorkshopSurvey, true), /vinculadas à sua conta Apogee/);
  assert.doesNotMatch(researchNotice(codexWorkshopSurvey), /vinculadas à sua conta Apogee/);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, valid).identityNoticeVersion, undefined);
  assert.ok(validateSurveySubmission(codexWorkshopSurvey, { ...valid, identityNoticeVersion: surveyIdentityNoticeVersion }));
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, identityNoticeVersion: -1 }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, {
    ...valid, research: false, answers: {}, radar: "deny", identityNoticeVersion: surveyIdentityNoticeVersion,
  }), null);
});

test("both survey writes reject requests without a valid session", async () => {
  const origin = "https://apogee.example.test";
  const neverWrite = () => assert.fail("Unauthenticated survey access reached storage");
  const { POST, PUT } = opportunityLoader({
    "@/lib/members/client-ip": {},
    "@/lib/members/dal": { getMemberFromHeaders: async () => null },
    "@/lib/members/mail": { applicationOrigin: () => origin },
    "@/lib/members/rate-limit": { consumeRateLimit: neverWrite },
    "@/lib/surveys/store": { surveysEnabled: () => true, recordSurveyResponse: neverWrite, recordSurveyProgress: neverWrite },
  })("app/api/pesquisas/[slug]/route.ts");
  for (const [method, handler] of [["POST", POST], ["PUT", PUT]]) {
    const response = await handler(new Request(origin + "/api/pesquisas/" + codexWorkshopSurvey.slug, {
      method, headers: { origin, "Content-Type": "application/json" }, body: "{}",
    }), { params: Promise.resolve({ slug: codexWorkshopSurvey.slug }) });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("without explicit configuration neither the public form nor the submission opens the database", async () => {
  const keys = ["APOGEE_LOCAL_PREVIEW", "APOGEE_SURVEYS_ENABLED"];
  const prior = keys.map(key => process.env[key]);
  for (const key of keys) delete process.env[key];
  try {
    const { getPublicSurvey, recordSurveyResponse } = opportunityLoader({
      "@/lib/admin/access": {},
      "@/lib/members/db": { getSql: () => assert.fail("Database accessed while surveys are disabled") },
    })("lib/surveys/store.ts");
    assert.equal(await getPublicSurvey(codexWorkshopSurvey.slug), null);
    assert.equal(await recordSurveyResponse(codexWorkshopSurvey.slug, valid), 404);
  } finally {
    keys.forEach((key, index) => {
      if (prior[index] === undefined) delete process.env[key];
      else process.env[key] = prior[index];
    });
  }
});
