import assert from "node:assert/strict";

// Run with a cua_repl tab on /makeitfly, using the matching viewport. Authentication,
// submissions and production services are not part of this navigation test.
export async function verifyMakeItFlyHistory(tab, {
  homeHeading,
  sectionLabel = "Programação",
  sectionId = "programacao",
  sectionEntry = "header",
  exit = "header",
  selectSection = true,
}) {
  const eventUrl = new URL("/makeitfly", await tab.url()).href;
  const homeUrl = new URL("/", eventUrl).href;
  const heading = tab.playwright.getByRole("heading", { name: "Make it fly", exact: true });
  await heading.waitFor({ state: "visible", timeoutMs: 8000 });
  if (selectSection) {
    await tab.playwright.getByRole(sectionEntry === "footer" ? "contentinfo" : "banner")
      .getByRole("link", { name: sectionLabel, exact: true }).click();
    await tab.getAXState({ emit: false });
  }
  assert.equal(await tab.url(), `${eventUrl}#${sectionId}`);

  const region = tab.playwright.getByRole(exit === "footer" ? "contentinfo" : "banner");
  await region.getByRole("link", { name: /Voltar à Apogee/i }).click();
  await tab.playwright.getByRole("heading", { name: homeHeading, exact: true }).waitFor({ state: "visible", timeoutMs: 8000 });
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), homeUrl);

  await tab.back();
  await tab.getAXState({ emit: false });
  try {
    await heading.waitFor({ state: "visible", timeoutMs: 5000 });
  } catch {
    const actual = await tab.playwright.locator("h1").allTextContents({});
    assert.fail(`Voltar deve restaurar Make it fly; URL=${await tab.url()}; h1=${actual.join(" | ")}`);
  }
  assert.equal(await tab.url(), `${eventUrl}#${sectionId}`);
  // Clicking a footer link scrolls to it before leaving; Back should restore
  // that exit position, while a fixed-header exit keeps the selected section.
  const restoredPosition = exit === "footer"
    ? tab.playwright.getByRole("contentinfo")
    : tab.playwright.locator(`#${sectionId}`);
  const section = await restoredPosition.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    viewport: window.innerHeight,
  }));
  assert.ok(section.top < section.viewport && section.bottom > 0, "Voltar deve restaurar também o ponto de saída visível");

  await tab.forward();
  await tab.playwright.getByRole("heading", { name: homeHeading, exact: true }).waitFor({ state: "visible", timeoutMs: 8000 });
  await tab.getAXState({ emit: false });
  assert.equal(await tab.url(), homeUrl);
  return { sectionId, exit, restoredContent: true, restoredExitPosition: true, forward: true };
}
