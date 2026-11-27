import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/members/db";
import { radarPreference, radarPreferenceDelivery, radarRecommendationDismissal } from "@/lib/members/schema";
import type { RadarEmail, RadarPreferences } from "./radar-preferences";

export async function getRadarPreference(userId: string) {
  const [preference] = await getDb().select().from(radarPreference).where(eq(radarPreference.userId, userId));
  return preference;
}

export async function saveRadarPreference(userId: string, settings: RadarPreferences, email: RadarEmail) {
  await getDb().transaction(async tx => {
    await tx.insert(radarPreference)
      .values({ userId, settings, emailOption: email, emailEnabledAt: email === "off" ? null : new Date() })
      .onConflictDoUpdate({
        target: radarPreference.userId,
        set: {
          settings,
          emailOption: email,
          emailEnabledAt: email === "off" ? null : sql`coalesce(${radarPreference.emailEnabledAt}, now())`,
        },
      });
    await tx.update(radarPreferenceDelivery).set({ subject: "", body: "" }).where(and(
      eq(radarPreferenceDelivery.userId, userId), isNull(radarPreferenceDelivery.sentAt),
    ));
  });
}

export async function dismissedRadarOpportunities(userId: string) {
  const saved = await getDb().select({ id: radarRecommendationDismissal.opportunityId })
    .from(radarRecommendationDismissal).where(eq(radarRecommendationDismissal.userId, userId));
  return new Set(saved.map(({ id }) => id));
}

export async function dismissRadarOpportunity(userId: string, id: string) {
  await getDb().insert(radarRecommendationDismissal)
    .select(getDb().select({ userId: radarPreference.userId, opportunityId: sql<string>`${id}` })
      .from(radarPreference).where(eq(radarPreference.userId, userId)))
    .onConflictDoNothing();
}
