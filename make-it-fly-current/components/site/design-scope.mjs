/** Event and local community funnel have their own isolated visual identities. */
export function usesApogeeDesign(pathname) {
  return typeof pathname === "string" && pathname !== "/comunidade" && pathname !== "/gravacao" && pathname !== "/makeitfly" && !pathname.startsWith("/makeitfly/");
}
