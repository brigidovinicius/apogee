// Closed vocabulary: no URLs, free text, account or session IDs.
export const BEHAVIOR_PAGES = ["home", "radar_list", "radar_detail", "radar_saved", "radar_calendar", "radar_access", "calendars", "calendar_detail", "collections", "collection_detail", "competitions", "blog_list", "blog_article", "store", "gallery", "makeitfly", "makeitfly_application", "login", "signup", "password_recovery", "community", "privacy", "terms"] as const;
export type BehaviorPage = typeof BEHAVIOR_PAGES[number];
export const BEHAVIOR_TARGETS = {
  page_view: ["view"], navigation: BEHAVIOR_PAGES,
  scroll_depth: ["25", "50", "75", "100"], engaged_time: ["15s", "30s", "60s"],
  section_view: ["experiencia", "jornada", "programacao", "manifesto", "quem-conduz", "participar", "galeria-preview"],
  action: ["save", "remove_saved", "alert_request", "series_alert_request", "checkout_start", "google_calendar", "official_link", "store_interest", "application_start", "application_open"],
  filter_apply: ["applied", "cleared"],
  form_progress: ["view", "started", "step_1", "step_2", "step_3", "validation_error", "submit_started", "submit_succeeded", "submit_failed"],
} as const;
export type BehaviorEventName = keyof typeof BEHAVIOR_TARGETS;
export type BehaviorEvent = { page: BehaviorPage; event: BehaviorEventName; target: string; device: "mobile" | "desktop" };
const routes: Record<string, BehaviorPage> = {
  "/": "home", "/oportunidades": "radar_list", "/membros/oportunidades": "radar_saved",
  "/membros/meu-calendario": "radar_calendar", "/membros/radar/acesso": "radar_access",
  "/calendarios": "calendars", "/membros/colecoes": "collections", "/membros/colecoes/acompanhadas": "collections",
  "/competicoes": "competitions", "/blog": "blog_list", "/loja": "store", "/galeria": "gallery",
  "/makeitfly": "makeitfly", "/makeitfly/participar": "makeitfly_application",
  "/login": "login", "/membros/entrar": "login", "/membros/cadastro": "signup",
  "/membros/esqueci-senha": "password_recovery", "/membros": "community", "/privacidade": "privacy", "/termos": "terms",
};
export function behaviorPage(pathname: string): BehaviorPage | null {
  // Only pathname. Never measure callbacks, reset links, profiles, invitations,
  // admin, forum content, shared bearer links or unknown paths.
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/oportunidades/avisos") return null;
  if (Object.hasOwn(routes, path)) return routes[path];
  if (/^\/oportunidades\/[^/?#]+$/.test(path) || /^\/membros\/oportunidades\/[^/?#]+$/.test(path)) return "radar_detail";
  if (/^\/blog\/[^/?#]+$/.test(path)) return "blog_article";
  if (/^\/calendarios\/[^/?#]+$/.test(path)) return "calendar_detail";
  if (/^\/membros\/colecoes\/[^/?#]+$/.test(path)) return "collection_detail";
  return null;
}
export function validBehaviorEvent(value: unknown): value is BehaviorEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 4 || Object.keys(item).some(key => !["page", "event", "target", "device"].includes(key))) return false;
  if (!(BEHAVIOR_PAGES as readonly unknown[]).includes(item.page) || typeof item.event !== "string" || !Object.hasOwn(BEHAVIOR_TARGETS, item.event)) return false;
  if (!(BEHAVIOR_TARGETS[item.event as BehaviorEventName] as readonly unknown[]).includes(item.target) || item.device !== "mobile" && item.device !== "desktop") return false;
  if (item.event === "form_progress" && item.page !== "makeitfly_application") return false;
  if (item.event === "section_view" && item.page !== "makeitfly") return false;
  if (item.event === "filter_apply" && !["radar_list", "radar_saved", "radar_calendar", "calendars", "calendar_detail"].includes(String(item.page))) return false;
  if (item.event === "action") {
    if (item.target === "store_interest") return item.page === "store";
    if (item.target === "application_open") return item.page === "makeitfly_application";
    if (item.target === "application_start") return item.page === "makeitfly";
    return ["radar_list", "radar_detail", "radar_saved", "radar_calendar", "radar_access", "competitions", "calendar_detail"].includes(String(item.page));
  }
  return true;
}
