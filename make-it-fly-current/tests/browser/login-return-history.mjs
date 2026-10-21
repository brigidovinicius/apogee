import assert from "node:assert/strict";

// Run with a cua_repl tab on a public source page and a signed-out local
// test account. The form, session, route guards and database must be real.
export async function verifyLoginReturnHistory(tab, {
  entryLink, account, sourceHeading, destinationHeading, destinationPath,
}) {
  const source = await tab.url();
  await entryLink.click();
  await tab.playwright.getByRole("heading", { name: "Entrar", exact: true })
    .waitFor({ state: "visible", timeoutMs: 10000 });
  await tab.getAXState({ emit: false });
  assert.equal(new URL(await tab.url()).searchParams.get("next"), destinationPath);
  await tab.playwright.getByRole("textbox", { name: "E-mail", exact: true }).fill(account.email);
  await tab.playwright.getByRole("textbox", { name: "Senha", exact: true }).fill(account.password);
  await tab.playwright.getByRole("button", { name: "Entrar", exact: true }).click();
  await tab.playwright.getByRole("heading", { name: destinationHeading, exact: true })
    .waitFor({ state: "visible", timeoutMs: 10000 });
  await tab.getAXState({ emit: false });
  const destination = new URL(await tab.url());
  assert.equal(destination.pathname + destination.search + destination.hash, destinationPath);

  await tab.back();
  await tab.playwright.getByRole("heading", { name: sourceHeading, exact: true })
    .waitFor({ state: "visible", timeoutMs: 10000 });
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), source, "Um único Voltar deve restaurar a origem, sem passar pelo login");
  await tab.forward();
  await tab.playwright.getByRole("heading", { name: destinationHeading, exact: true })
    .waitFor({ state: "visible", timeoutMs: 10000 });
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), destination.href);
  return { destinationPath, backRestoresSourceInOneStep: true, forwardRestoresAuthenticatedDestination: true };
}
