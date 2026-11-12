/** Make It Fly and its community-page clone keep the event's visual identity. */
export function usesApogeeDesign(pathname) {
  return typeof pathname === "string" && pathname !== "/comunidade" && pathname !== "/makeitfly" && !pathname.startsWith("/makeitfly/");
}
