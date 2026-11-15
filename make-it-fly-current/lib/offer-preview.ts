import "server-only";

/** Review fixtures are available only in an explicitly enabled development server. */
export function localOfferPreview() {
  return process.env.NODE_ENV === "development" && process.env.APOGEE_LOCAL_PREVIEW === "1";
}

/** Functional review uses isolated loopback data; it cannot enable a production bypass. */
export function localFunctionalReview() {
  if (process.env.NODE_ENV !== "development" || process.env.APOGEE_FUNCTIONAL_REVIEW !== "1" || process.env.STRIPE_MODE !== "test") return false;
  try { return new URL(process.env.DATABASE_URL ?? "").hostname === "127.0.0.1"; } catch { return false; }
}

/** Local Stripe testing keeps the real billing flow, while only the catalogue is synthetic. */
export function localStripeSandboxReview() {
  if (process.env.NODE_ENV !== "development" || process.env.APOGEE_STRIPE_SANDBOX_REVIEW !== "1" || process.env.STRIPE_MODE !== "test" ||
      !/^(?:rk|sk)_test_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY ?? "")) return false;
  try { return new URL(process.env.DATABASE_URL ?? "").hostname === "127.0.0.1"; } catch { return false; }
}
