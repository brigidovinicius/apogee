"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSignedInMember } from "@/lib/members/dal";
import { getRadarPreference, saveRadarPreference } from "@/lib/opportunities/radar-preference-store";
import { radarPreferenceMailSecret } from "@/lib/opportunities/radar-preference-mail-config";
import { parseRadarPreferences, RADAR_FOR_YOU, RADAR_PREFERENCES } from "@/lib/opportunities/radar-preferences";

export async function saveRadarPreferences(
  _previous: { error?: string }, data: FormData,
): Promise<{ error?: string }> {
  const member = await requireSignedInMember(RADAR_PREFERENCES);
  const parsed = parseRadarPreferences(data);
  if ("error" in parsed) return { error: parsed.error };
  try {
    const existing = radarPreferenceMailSecret() ? undefined : await getRadarPreference(member.id);
    const email = data.has("email") ? parsed.email : existing?.emailOption ?? "off";
    if (email !== "off" && !radarPreferenceMailSecret() && email !== existing?.emailOption) {
      return { error: "Os avisos por e-mail estão temporariamente indisponíveis." };
    }
    await saveRadarPreference(member.id, parsed.settings, email);
  } catch {
    return { error: "Não conseguimos salvar suas preferências. Tente novamente." };
  }
  revalidatePath(RADAR_PREFERENCES);
  revalidatePath(RADAR_FOR_YOU);
  redirect(RADAR_FOR_YOU);
}
