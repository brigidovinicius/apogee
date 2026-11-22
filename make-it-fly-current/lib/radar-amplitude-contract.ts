export const radarAmplitudePrivacyAnchor = "radar-amplitude";
export const radarAmplitudeConsentVersion = 2;

export type RadarAmplitudeView = "radar_list_viewed" | "radar_detail_viewed";

export type RadarAmplitudeBrowserEvent = RadarAmplitudeView | "radar_official_link_clicked";

export function isRadarAmplitudeBrowserEvent(value: unknown): value is RadarAmplitudeBrowserEvent {
  return value === "radar_list_viewed" || value === "radar_detail_viewed" || value === "radar_official_link_clicked";
}

export function isRadarAmplitudeGrant(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
}
