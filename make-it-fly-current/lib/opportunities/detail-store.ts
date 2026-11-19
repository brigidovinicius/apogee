import "server-only";
import { getSql } from "@/lib/members/db";
import { RADAR_FREE_EVENT_LIMIT } from "@/content/community-offer";
import { monthlyDetailState } from "@/lib/members/monthly-detail";
import type { StudentOpportunity } from "./types";

export function isFreeRadarEvent(item: StudentOpportunity) {
  return item.categories?.includes("eventos") === true;
}

export async function radarMonthlyState(userId: string) {
  const [monthly, legacy, selected] = await Promise.all([
    monthlyDetailState(userId, "radar"),
    getSql()<{ opportunity_id: string }[]>`select opportunity_id from radar_free_event where user_id=${userId}`,
    freeRadarOpportunity(userId),
  ]);
  const readableIds = new Set([...monthly.ids, ...legacy.map(row => row.opportunity_id)]);
  if (selected) readableIds.add(selected);
  return { ...monthly, selected, readableIds: [...readableIds] };
}

export async function freeRadarState(userId: string, catalogue: StudentOpportunity[]) {
  const selected = await freeRadarOpportunity(userId);
  const rows = await getSql()`select opportunity_id from radar_free_event where user_id=${userId} order by slot`;
  const eventIds = rows.map(row => String(row.opportunity_id));
  const previousEvent = catalogue.find(item => item.id === selected && isFreeRadarEvent(item))?.id ?? null;
  const counted = new Set([...eventIds, ...(previousEvent ? [previousEvent] : [])]);
  // Grandfathered selections remain readable even if taxonomy/availability changes.
  return { selected, previousEvent, eventIds, readableIds: [...new Set([...eventIds, ...(selected ? [selected] : [])])],
    used: Math.min(counted.size, RADAR_FREE_EVENT_LIMIT), remaining: Math.max(0, RADAR_FREE_EVENT_LIMIT-counted.size), limit: RADAR_FREE_EVENT_LIMIT };
}

export async function claimFreeRadarEvent(userId: string, opportunityId: string, previousEvent: string | null) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(opportunityId)) return false;
  return getSql().begin(async tx => {
    const [user] = await tx`select id from "user" where id=${userId} and blocked=false for update`;
    if (!user) return false;
    const rows = await tx`select opportunity_id,slot from radar_free_event where user_id=${userId} order by slot`;
    const [old] = await tx`select opportunity_id from radar_free_opportunity where user_id=${userId}`;
    const ids = new Set(rows.map(row => String(row.opportunity_id)));
    const slots = new Set(rows.map(row => Number(row.slot)));
    const add = async (id: string) => {
      const slot = Array.from({length:RADAR_FREE_EVENT_LIMIT},(_,i)=>i+1).find(n=>!slots.has(n));
      if (!slot) return false;
      await tx`insert into radar_free_event(user_id,opportunity_id,slot) values(${userId},${id},${slot})`;
      slots.add(slot); ids.add(id); return true;
    };
    if (previousEvent && old?.opportunity_id === previousEvent && !ids.has(previousEvent)) {
      if (!await add(previousEvent) && old?.opportunity_id !== opportunityId) return false;
    }
    if (ids.has(opportunityId) || old?.opportunity_id === opportunityId) return true;
    return add(opportunityId);
  });
}

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
