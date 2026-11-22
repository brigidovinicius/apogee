import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { codexWorkshopSurvey } = load("lib/surveys/templates.ts");
const { surveyDefinition, validateSurveySubmission } = load("lib/surveys/contract.ts");
const valid = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  research: true,
  answers: { nota: 0, tarefa: "Revisar uma apresentação sintética", obstaculo: "Conferir e corrigir o resultado." },
  collaboration: null,
  email: null,
  radar: null,
};

test("the workshop template can be reviewed as a draft before retention is set", () => {
  assert.equal(surveyDefinition.safeParse(codexWorkshopSurvey).success, true);
  assert.equal(surveyDefinition.safeParse({ ...codexWorkshopSurvey, status: "open" }).success, false);
  assert.equal(surveyDefinition.safeParse({ ...codexWorkshopSurvey, status: "open", retentionDays: 30 }).success, true);
});

test("zero is a valid rating and answers must match the saved fields", () => {
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, valid).answers.nota, 0);
  for (const answers of [
    { ...valid.answers, nota: 11 },
    { ...valid.answers, nota: "0" },
    { ...valid.answers, obstaculo: "Opção de outra versão" },
    { ...valid.answers, desconhecida: "valor fora da pesquisa" },
    { ...valid.answers, tarefa: " " },
  ]) assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, answers }), null);
});

test("research, the invitation and the Radar choice are independent", () => {
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, email: "fixture@example.test" }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, collaboration: "exercise" }), null);
  assert.ok(validateSurveySubmission(codexWorkshopSurvey, { ...valid, collaboration: "exercise", email: "fixture@example.test" }));
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, radar: "allow" }), null);
  assert.ok(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, answers: {}, radar: "deny" }));
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, research: false, answers: {} }), null);
  assert.equal(validateSurveySubmission({ ...codexWorkshopSurvey, radar: false }, { ...valid, radar: "allow" }), null);
  assert.equal(validateSurveySubmission(codexWorkshopSurvey, { ...valid, accountId: "fixture" }), null);
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
