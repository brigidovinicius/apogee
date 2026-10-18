/** The event and its registration keep their own visual identity. */
export function usesApogeeDesign(pathname) {
  return typeof pathname === "string" && pathname !== "/makeitfly" && !pathname.startsWith("/makeitfly/");
}
