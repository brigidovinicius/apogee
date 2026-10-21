import "server-only";
import { getSql } from "@/lib/members/db";

export async function freeRadarOpportunity(userId: string): Promise<string | null> {
  const [row] = await getSql()`select opportunity_id from radar_free_opportunity where user_id = ${userId}`;
  return row ? String(row.opportunity_id) : null;
}

// One row per account makes concurrent requests (including different devices)
// compete for the same slot. Reopening never replaces the chosen opportunity.
export async function claimFreeRadarOpportunity(userId: string, opportunityId: string): Promise<boolean> {
  return getSql().begin(async tx => {
    const [user] = await tx`select id from "user" where id = ${userId} and blocked = false for update`;
    if (!user) return false;
    await tx`insert into radar_free_opportunity (user_id, opportunity_id) values (${userId}, ${opportunityId})
      on conflict (user_id) do nothing`;
    const [row] = await tx`select opportunity_id from radar_free_opportunity where user_id = ${userId}`;
    return row?.opportunity_id === opportunityId;
  });
}
