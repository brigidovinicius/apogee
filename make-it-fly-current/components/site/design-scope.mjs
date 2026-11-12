/** Event and community funnel have their own isolated visual identities. */
export function usesApogeeDesign(pathname) {
  return typeof pathname === "string" && pathname !== "/comunidade" && pathname !== "/gravacao" && pathname !== "/evento-openai" && pathname !== "/makeitfly" && !pathname.startsWith("/makeitfly/");
}
