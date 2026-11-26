export const EVENTS_PATH = "/membros/eventos";
export const WORKSHOP = {
  slug: "workshop-codex-community-florianopolis",
  title: "Codex Community Workshop",
  location: "Florianópolis, SC",
  startsAt: "2026-11-21T18:00:00-03:00",
  dateLabel: "21 de novembro de 2026",
  recording: "/evento-openai/ao-vivo",
};
export const WORKSHOP_MEDIA_PATH = `${EVENTS_PATH}/${WORKSHOP.slug}`;

export const upcomingEvents: readonly {
  slug: string;
  title: string;
  dateLabel: string;
  location: string;
  registration: string;
}[] = [];

export const mediaEvents = [WORKSHOP];

export const PHOTO_API = "/api/eventos/fotos";
export const VIDEO_API = "/api/eventos/video";
export const PHOTO_CONSENT_API = "/api/eventos/fotos/consentimento";
export const PHOTO_OPT_IN = "opt-in-v1";
export type PhotoOptIn = { granted: boolean; indexed: boolean };

export const SELFIE_CONSENT = "selfie-v1";
export const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

export type AlbumPhoto = { id: string; thumbnail: string; download: string };
