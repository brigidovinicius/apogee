import "server-only";
import { privacyPolicyReady } from "./privacy-policy";
import { termsOfUseReady } from "./terms-of-use";

export function getSiteLegalLinks() {
  const preview = process.env.APOGEE_LOCAL_PREVIEW === "1";
  return {
    privacy: preview || privacyPolicyReady(),
    terms: preview || termsOfUseReady(),
  };
}
