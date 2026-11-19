// Closed vocabulary: no URLs, free text, account or session IDs.
export const BEHAVIOR_PAGES = ["home", "radar_list", "radar_detail", "radar_saved", "radar_calendar", "radar_access", "calendars", "calendar_detail", "collections", "collection_detail", "competitions", "blog_list", "blog_article", "store", "gallery", "makeitfly", "makeitfly_application", "login", "signup", "password_recovery", "community", "privacy", "terms", "annual_offer", "annual_summary", "event_page", "member_benefits", "member_toolbox", "member_learning"] as const;
export type BehaviorPage = typeof BEHAVIOR_PAGES[number];
export const BLOG_RADAR_ARTICLES = [
  { key: "cloud_models", label: "IaaS, PaaS e SaaS", path: "/blog/como-se-diferenciam-os-modelos-de-computacao-em-nuvem-iaas-paas-e-6a925d772d69a0d0054887b3" },
  { key: "competitor_research", label: "Pesquisa de concorrentes", path: "/blog/apogee-be2499dd4578ae0f1f55b86e" },
] as const;
const blogRadarTargets = BLOG_RADAR_ARTICLES.map(article => article.key);
export function blogRadarArticle(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  return BLOG_RADAR_ARTICLES.find(article => article.path === path)?.key ?? null;
}
export const BEHAVIOR_TARGETS = {
  page_view: ["view"], navigation: BEHAVIOR_PAGES,
  blog_radar_view: blogRadarTargets, blog_radar_click: blogRadarTargets,
  scroll_depth: ["25", "50", "75", "100"], engaged_time: ["15s", "30s", "60s"],
  section_view: ["annual_price", "account_ready", "confirmed_return", "experiencia", "jornada", "programacao", "manifesto", "quem-conduz", "participar", "galeria-preview"],
  action: ["annual_choose", "save", "remove_saved", "alert_request", "series_alert_request", "checkout_start", "google_calendar", "official_link", "store_interest", "application_start", "application_open", "event_online_selected", "event_workshop_selected", "event_luma_opened"],
  filter_apply: ["applied", "cleared"],
  form_progress: ["view", "started", "step_1", "step_2", "step_3", "validation_error", "submit_started", "submit_succeeded", "submit_failed"],
} as const;
export type BehaviorEventName = keyof typeof BEHAVIOR_TARGETS;
export type BehaviorEvent = { page: BehaviorPage; event: BehaviorEventName; target: string; device: "mobile" | "desktop" };
const routes: Record<string, BehaviorPage> = {
  "/evento-openai": "event_page", "/membros/beneficios": "member_benefits",
  "/membros/ferramentas": "member_toolbox", "/membros/trilha": "member_learning",
  "/comunidade": "annual_offer", "/membros/assinatura": "annual_summary",
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
  if (typeof item.target !== "string" || !(BEHAVIOR_TARGETS[item.event as BehaviorEventName] as readonly string[]).includes(item.target) || item.device !== "mobile" && item.device !== "desktop") return false;
  if ((item.event === "blog_radar_view" || item.event === "blog_radar_click") && item.page !== "blog_article") return false;
  if (item.event === "form_progress" && item.page !== "makeitfly_application") return false;
  if (item.event === "section_view") {
    if (item.target === "annual_price") return item.page === "annual_offer";
    if (item.target === "account_ready" || item.target === "confirmed_return") return item.page === "annual_summary";
    return item.page === "makeitfly";
  }
  if (item.event === "filter_apply" && !["radar_list", "radar_saved", "radar_calendar", "calendars", "calendar_detail"].includes(String(item.page))) return false;
  if (item.event === "action") {
    if (["event_online_selected", "event_workshop_selected", "event_luma_opened"].includes(item.target)) return item.page === "event_page";
    if (item.target === "annual_choose") return item.page === "annual_offer";
    if (item.page === "annual_summary") return item.target === "checkout_start";
    if (item.target === "store_interest") return item.page === "store";
    if (item.target === "application_open") return item.page === "makeitfly_application";
    if (item.target === "application_start") return item.page === "makeitfly";
    return ["radar_list", "radar_detail", "radar_saved", "radar_calendar", "radar_access", "competitions", "calendar_detail"].includes(String(item.page));
  }
  return true;
}
