import "server-only";
import { getSql } from "@/lib/members/db";

export async function communityAccess(userId: string, livemode: boolean) {
  const [row] = await getSql()`select max(i.period_end) as paid_until
    from community_subscription s join community_invoice i on i.subscription_id=s.id
    join "user" u on u.id=s.user_id
    where s.user_id=${userId} and s.livemode=${livemode} and u.blocked=false
      and i.status='paid' and i.fraud_review_required=false and i.period_start<=now() and i.period_end>now()`;
  return { active: Boolean(row?.paid_until), paidUntil: row?.paid_until ? new Date(row.paid_until).toISOString() : null };
}

export async function communityMembership(userId: string, livemode: boolean) {
  const access=await communityAccess(userId,livemode);
  const rows=await getSql()`select id,status,cancel_at_period_end from community_subscription
    where user_id=${userId} and livemode=${livemode} order by updated_at desc limit 1`;
  return {...access, subscription:rows[0] ? {id:String(rows[0].id),status:String(rows[0].status),cancelAtPeriodEnd:rows[0].cancel_at_period_end === true}:null};
}
