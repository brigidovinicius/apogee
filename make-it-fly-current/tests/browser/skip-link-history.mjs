import assert from "node:assert/strict";

// Start on a fresh source route. exitLink is a locator for its next destination.
export async function verifySkipLinkHistory(tab, { sourceHeading, exitLink, destinationHeading }) {
  const source = new URL(await tab.url());
  source.hash = "experiencia";
  await tab.playwright.getByRole("link", { name: "Pular para o conteúdo", exact: true }).press("Enter");
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), source.href);
  await exitLink.click();
  await tab.playwright.getByRole("heading", { name: destinationHeading, exact: true })
    .waitFor({ state: "visible", timeoutMs: 5000 });
  await tab.getAXState({ emit: false });
  await tab.back();
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), source.href);
  const headings = await tab.playwright.locator("h1").allTextContents({});
  assert.equal(headings.length, 1);
  assert.equal(headings[0], sourceHeading, "Voltar deve restaurar o conteúdo da rota do atalho");
  await tab.forward();
  await tab.playwright.getByRole("heading", { name: destinationHeading, exact: true })
    .waitFor({ state: "visible", timeoutMs: 5000 });
  await tab.getAXState({ emit: false });
  return { source: source.pathname, restoredContent: true, forward: true };
}
