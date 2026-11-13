import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("site-wide entry follows the server-provided feature flag", () => {
  const load = opportunityLoader({
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
    "next/image": { __esModule: true, default: () => null },
  });
  const { McpAvailabilityProvider, McpConnectLink } = load("components/site/mcp-connect-link.tsx");
  const { SiteHeader } = load("components/site/site-header.tsx");
  const { SiteFooter } = load("components/site/site-footer.tsx");
  for (const enabled of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(McpAvailabilityProvider, { enabled }, React.createElement(McpConnectLink)));
    if (enabled) { assert.match(html, /Incluir no meu ChatGPT/); assert.match(html, /href="\/membros\/integracoes\/mcp"/); }
    else assert.equal(html, "");
    const shell = renderToStaticMarkup(React.createElement(McpAvailabilityProvider, { enabled },
      React.createElement(React.Fragment, null, React.createElement(SiteHeader), React.createElement(SiteFooter))));
    assert.equal((shell.match(/Incluir no meu ChatGPT/g) ?? []).length, enabled ? 3 : 0, "desktop, mobile and footer follow the same flag");
    assert.equal((shell.match(/Incluir no meu Claude/g) ?? []).length, enabled ? 2 : 0, "mobile and footer also offer Claude");
  }
});

test("guided setup opens official Plugins, exposes a selectable endpoint and does not claim installation", async () => {
  const load = opportunityLoader(); const { McpSetup } = load("components/members/mcp-setup.tsx");
  const html = renderToStaticMarkup(React.createElement(McpSetup, { resource: "https://www.apogee.community/mcp" }));
  assert.match(html, /href="https:\/\/chatgpt.com\/plugins" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Incluir no meu ChatGPT/); assert.match(html, /concluirá a conexão por lá/);
  assert.match(html, /Incluir no meu Claude/); assert.match(html, /href="https:\/\/claude.ai\/customize\/connectors"/);
  assert.match(html, /Register automatically/);
  assert.match(html, /readOnly="" value="https:\/\/www.apogee.community\/mcp"/);
  assert.match(html, /OAuth/); assert.match(html, /Add custom MCP server/);
  assert.doesNotMatch(html, /instalação concluída|conectado com sucesso|api_key|access_token|[?&]token=/i);
});

for (const denied of [false, true]) test(`setup copy ${denied ? "denial provides manual recovery" : "copies only the public endpoint"}`, async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const states = []; let index = 0, copied;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async value => { if (denied) throw Error("Denied"); copied = value; } } } });
  const load = opportunityLoader({ react: { useId: () => "feedback", useState: value => { const slot = index++; if (!(slot in states)) states[slot] = value; return [states[slot], next => { states[slot] = next; }]; } } });
  const { McpSetup } = load("components/members/mcp-setup.tsx");
  function render() { index = 0; return McpSetup({ resource: "https://www.apogee.community/mcp" }); }
  try {
    const tree = render();
    const address = tree.props.children.find(child => child?.props?.className === "address");
    let selected = false;
    address.props.children[0].props.children[1].props.onFocus({ currentTarget: { select() { selected = true; } } });
    assert.equal(selected, true);
    await address.props.children[1].props.onClick();
    const feedback = render().props.children.find(child => child?.props?.role === "status").props.children;
    if (denied) { assert.equal(copied, undefined); assert.match(feedback, /Selecione e copie/); }
    else { assert.equal(copied, "https://www.apogee.community/mcp"); assert.match(feedback, /Endereço copiado/); }
  } finally { if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else delete globalThis.navigator; }
});
