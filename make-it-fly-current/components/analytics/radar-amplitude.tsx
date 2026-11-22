import { getCurrentMember } from "@/lib/members/dal";
import { radarAmplitudeConfig, radarAmplitudePreference } from "@/lib/radar-amplitude";
import type { RadarAmplitudeView } from "@/lib/radar-amplitude-contract";
import { RadarAmplitudePreferences } from "./radar-amplitude-preferences";

type Props = { view: RadarAmplitudeView; memberId?: string };

export function RadarAmplitude(props: Props) {
  if (!radarAmplitudeConfig()) return null;
  return <EligibleRadarAmplitude {...props} />;
}

async function EligibleRadarAmplitude({ view, memberId }: Props) {
  let grant: string | null | undefined;
  try {
    const id = memberId ?? (await getCurrentMember())?.id;
    if (!id) return null;
    grant = await radarAmplitudePreference(id);
  } catch {
    return null;
  }
  return grant === undefined ? null : <RadarAmplitudePreferences view={view} initialGrant={grant} />;
}
