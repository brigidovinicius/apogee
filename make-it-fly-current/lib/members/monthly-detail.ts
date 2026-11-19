import "server-only";
import { getSql } from "@/lib/members/db";
import { MONTHLY_DETAIL_LIMIT } from "@/content/community-offer";

export type MonthlyDetailArea = "radar" | "beneficios";
export type MonthlyDetailQuota = { used: number; remaining: number; limit: number; renewsOn: string };

export async function monthlyDetailState(userId: string, area: MonthlyDetailArea) {
  const [row] = await getSql()<{ ids: string[]; renews_on: string }[]>`
    with quota_window as (
      select date_trunc('month', now() at time zone 'America/Sao_Paulo') as start_date
    )
    select coalesce(array_agg(q.item_id) filter (where q.item_id is not null), '{}'::text[]) as ids,
      to_char(w.start_date + interval '1 month', 'YYYY-MM-DD') as renews_on
    from quota_window w left join member_monthly_detail_unlock q
      on q.user_id=${userId} and q.area=${area} and q.period=w.start_date::date
    group by w.start_date`;
  const used = row.ids.length;
  return { ids: row.ids, used, limit: MONTHLY_DETAIL_LIMIT, remaining: Math.max(0, MONTHLY_DETAIL_LIMIT - used), renewsOn: row.renews_on };
}

export async function claimMonthlyDetail(userId: string, area: MonthlyDetailArea, itemId: string) {
  await getSql().begin(async tx => {
    // Recheck the account and serialize simultaneous unlocks before counting the period.
    const [account] = await tx`select id from "user" where id=${userId} and blocked=false for update`;
    if (!account) return;
    if (area === "beneficios") {
      const [offer] = await tx`select id from member_benefit b
        where b.id=${itemId} and public.member_benefit_is_available(b) for share`;
      if (!offer) return;
    }
    await tx`with quota_window as (
        select date_trunc('month', clock_timestamp() at time zone 'America/Sao_Paulo')::date as start_date
      )
      insert into member_monthly_detail_unlock (user_id, area, period, item_id)
      select ${userId}, ${area}, w.start_date, ${itemId} from quota_window w
      where (select count(*) from member_monthly_detail_unlock q
        where q.user_id=${userId} and q.area=${area} and q.period=w.start_date) < ${MONTHLY_DETAIL_LIMIT}
      on conflict do nothing`;
  });
}
