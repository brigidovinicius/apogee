import "server-only";
import { cache } from "react";
import { communityAccess } from "@/lib/billing/community-store";
import { adultAccess } from "@/lib/members/protection";
import { getSql } from "@/lib/members/db";

const unavailable = { ferramentas: false };

export const publishedResourceAvailability = cache(async () => {
  try {
    const [state] = await getSql()<{ ferramentas: boolean }[]>`select
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
