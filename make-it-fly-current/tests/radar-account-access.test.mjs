import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function fixture() {
  const state = { session: true, reviewReads: 0, approved: false, user: {
    id: "new-member", name: "Pessoa Teste", username: "pessoa", blocked: false,
    email_verified: false, role: "member", nameNeedsConfirmation: false,
  } };
  const load = opportunityLoader({
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: path => { throw Error(`REDIRECT:${path}`); } },
    react: { cache: fn => fn },
    "./auth": { getAuth: () => ({ api: { getSession: async () => state.session ? { user: { id: state.user?.id } } : null } }) },
    "./db": { getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => state.user ? [state.user] : [] }) }) }) }) },
    "./schema": { user: { id: "user-id" } },
    "./protection": { adultAccess: async () => { state.reviewReads++; return state.approved; } },
  });
  return { state, dal: load("lib/members/dal.ts") };
}

test("a new signed-in account opens Radar without verified email or community approval", async () => {
  const { state, dal } = fixture();
  assert.equal((await dal.requireSignedInMember("/membros/oportunidades/first")).id, "new-member");
  assert.equal(state.reviewReads, 0);
  await assert.rejects(dal.requireMember("/membros"), /REDIRECT:\/membros\/protecao/);
  assert.equal(state.reviewReads, 1, "community authorization still requires review");
  state.approved = true;
  assert.equal((await dal.requireMember("/membros")).id, "new-member");
});

test("anonymous, blocked and removed accounts cannot use the signed-in Radar guard", async () => {
  for (const condition of ["anonymous", "blocked", "removed"]) {
    const { state, dal } = fixture();
    if (condition === "anonymous") state.session = false;
    if (condition === "blocked") state.user.blocked = true;
    if (condition === "removed") state.user = null;
    await assert.rejects(dal.requireSignedInMember("/membros/oportunidades/first"), /REDIRECT:\/membros\/entrar\?next=%2Fmembros%2Foportunidades%2Ffirst/);
    assert.equal(state.reviewReads, 0);
  }
});

test("Google and incomplete profiles retain their Radar destination during setup", async () => {
  for (const field of ["username", "nameNeedsConfirmation"]) {
    const { state, dal } = fixture();
    if (field === "username") state.user.username = "google_" + "a".repeat(20);
    else state.user.nameNeedsConfirmation = true;
    await assert.rejects(dal.requireSignedInMember("/membros/oportunidades/first"), /REDIRECT:\/membros\/perfil\/configurar\?next=%2Fmembros%2Foportunidades%2Ffirst/);
  }
});
