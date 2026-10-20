import "server-only";
import { redirect } from "next/navigation";
import { radarAccess } from "./store";
import { billingConfig, RADAR_ACCESS_PATH, radarBillingEnabled } from "./config";

export async function requireRadarAccess(userId: string) {
  if (!radarBillingEnabled()) return;
  if (!(await radarAccess(userId, billingConfig().livemode)).active) redirect(RADAR_ACCESS_PATH);
}
