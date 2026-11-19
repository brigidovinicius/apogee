import "server-only";
import { cache } from "react";
import { communityAccess } from "@/lib/billing/community-store";
import { adultAccess } from "@/lib/members/protection";
import { getSql } from "@/lib/members/db";

const unavailable = { trilha: false, ferramentas: false };

export const publishedResourceAvailability = cache(async () => {
  try {
    const [state] = await getSql()<{ trilha: boolean; ferramentas: boolean }[]>`select
      exists(select 1 from member_learning_activity a join member_learning_module m on m.id=a.module_id
        join member_learning_track t on t.id=m.track_id
        where a.status='published' and m.status='published' and t.status='published') as trilha,
      exists(select 1 from member_tool t join member_tool_category c on c.id=t.category_id
        where t.status='published' and c.status='published') as ferramentas`;
    return state ?? unavailable;
  } catch {
    return unavailable;
  }
});

export const memberResourceAvailability = cache(async (id: string, role: "member" | "admin") => {
  try {
    const authorized = role === "admin" || (await communityAccess(id, process.env.STRIPE_MODE !== "test")).active;
    if (!authorized || !await adultAccess(id)) return unavailable;
    return await publishedResourceAvailability();
  } catch {
    return unavailable;
  }
});
