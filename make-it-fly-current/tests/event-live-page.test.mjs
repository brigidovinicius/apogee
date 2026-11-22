import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const empty = () => null;
const shell = {
  "next/link": ({ children, href, className }) => createElement("a", { href, className }, children),
  "next/image": empty,
  "@/components/site/site-footer": { SiteFooter: empty },
  "./community-funnel": { CommunityJoinButton: empty, FunnelFaq: empty, FunnelHeader: empty },
};

test("the event page embeds the workshop recording with a direct YouTube link", () => {
  const { EVENT_LIVE_PATH, EVENT_LIVE_URL } = opportunityLoader()("lib/community/event-live.ts");
  assert.equal(EVENT_LIVE_PATH, "/evento-openai/ao-vivo");
  const { EventLivePage } = opportunityLoader(shell)("components/community/event-live-page.tsx");
  const html = renderToStaticMarkup(createElement(EventLivePage, { registered: false }));
  assert.equal(EVENT_LIVE_URL, "https://www.youtube.com/watch?v=msc2Hz8Uuzc");
  assert.match(html, /<iframe[^>]+src="https:\/\/www\.youtube-nocookie\.com\/embed\/msc2Hz8Uuzc"/);
  assert.match(html, /<iframe[^>]+title="Gravação do Codex Community Workshop"/);
  assert.match(html, /allowFullScreen=""|allowfullscreen=""/i);
  assert.ok(html.includes(`href="${EVENT_LIVE_URL}"`));
  assert.ok(html.includes("Assistir no YouTube"));
  assert.ok(html.includes("Assista à gravação"));
  assert.ok(!html.includes("Inscrição registrada"));
  assert.ok(renderToStaticMarkup(createElement(EventLivePage, { registered: true })).includes("Inscrição registrada"));
});

test("the live route is not indexed and reads the confirmation flag", async () => {
  const load = opportunityLoader({ "@/components/community/event-live-page": { EventLivePage: props => createElement("p", null, JSON.stringify(props)) } });
  const route = load("app/evento-openai/ao-vivo/page.tsx");
  assert.equal(route.metadata.robots.index, false);
  assert.equal(renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({ inscricao: "ok" }) })), '<p>{&quot;registered&quot;:true}</p>');
  assert.equal(renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({}) })), '<p>{&quot;registered&quot;:false}</p>');
});

test("the event registration form sends people to the live page after signing up", () => {
  let received;
  const load = opportunityLoader({
    ...shell,
    "./recording-capture-form": { RecordingCaptureForm: props => { received = props; return null; } },
  });
  const { EventRecordingPage } = load("components/community/event-recording-page.tsx");
  renderToStaticMarkup(createElement(EventRecordingPage));
  assert.equal(received.successHref, "/evento-openai/ao-vivo?inscricao=ok");
});
