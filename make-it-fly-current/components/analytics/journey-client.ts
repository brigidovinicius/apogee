"use client";

export type JourneyEventName =
  | "page_view"
  | "section_view"
  | "scroll_depth"
  | "cta_click"
  | "form_view"
  | "form_started"
  | "form_step_completed"
  | "form_validation_error"
  | "form_submit_started"
  | "form_submit_succeeded"
  | "form_submit_failed";

type JourneyEvent = {
  eventId: string;
  journeyId: string;
  eventName: JourneyEventName;
  path: "/" | "/participar";
  context: string;
  step: number | null;
  device: "mobile" | "desktop";
};

const JOURNEY_KEY = "makeitfly:journey:v1";
let fallbackJourneyId = "";
let queue: JourneyEvent[] = [];
let timer: number | undefined;

function validUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function trackingAllowed() {
  return typeof window !== "undefined" && navigator.doNotTrack !== "1";
}

export function getJourneyId() {
  if (typeof window === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(JOURNEY_KEY);
    if (validUuid(stored)) return stored;
    const created = crypto.randomUUID();
    sessionStorage.setItem(JOURNEY_KEY, created);
    return created;
  } catch {
    if (!validUuid(fallbackJourneyId)) fallbackJourneyId = crypto.randomUUID();
    return fallbackJourneyId;
  }
}

// O Make It Fly vive em /makeitfly, mas os eventos mantêm os caminhos lógicos
// "/" e "/participar" que o banco já valida.
export function journeyPath(pathname: string): JourneyEvent["path"] | null {
  if (pathname === "/makeitfly") return "/";
  if (pathname === "/makeitfly/participar") return "/participar";
  return null;
}

function currentPath(): JourneyEvent["path"] {
  return journeyPath(window.location.pathname) ?? "/";
}

export function trackJourney(eventName: JourneyEventName, context = "", step: number | null = null) {
  if (!trackingAllowed()) return;
  const journeyId = getJourneyId();
  if (!validUuid(journeyId)) return;
  queue.push({
    eventId: crypto.randomUUID(),
    journeyId,
    eventName,
    path: currentPath(),
    context: context.toLowerCase().replace(/[^a-z0-9_,.-]/g, "_").slice(0, 160),
    step,
    device: window.matchMedia("(max-width: 800px)").matches ? "mobile" : "desktop",
  });
  if (queue.length > 100) queue = queue.slice(-100);
  if (queue.length >= 10) void flushJourneyEvents();
  else if (timer === undefined) timer = window.setTimeout(() => void flushJourneyEvents(), 800);
}

export async function flushJourneyEvents(useBeacon = false) {
  if (typeof window === "undefined" || !queue.length) return;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  const events = queue.splice(0, 20);
  const body = JSON.stringify({ events });
  if (useBeacon && navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/journey", new Blob([body], { type: "application/json" }));
    if (!sent) queue.unshift(...events);
    return;
  }
  try {
    const response = await fetch("/api/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body,
    });
    if (!response.ok && response.status >= 500) queue.unshift(...events);
  } catch {
    queue.unshift(...events);
  }
  if (queue.length && timer === undefined) timer = window.setTimeout(() => void flushJourneyEvents(), 2000);
}
