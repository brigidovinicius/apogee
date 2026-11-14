import "server-only";

/** Review fixtures are available only in an explicitly enabled development server. */
export function localOfferPreview() {
  return process.env.NODE_ENV === "development" && process.env.APOGEE_LOCAL_PREVIEW === "1";
}
