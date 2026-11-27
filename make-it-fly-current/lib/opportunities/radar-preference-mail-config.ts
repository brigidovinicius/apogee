import "server-only";
import { memberMailAvailable } from "@/lib/members/mail";

export function radarPreferenceMailSecret() {
  const secret = process.env.RADAR_PROFILE_MAIL_SECRET;
  return process.env.RADAR_PROFILE_MAIL_ENABLED === "true" && secret && secret.length >= 32 && memberMailAvailable()
    ? secret : null;
}
