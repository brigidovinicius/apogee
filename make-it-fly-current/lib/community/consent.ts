export const COMMUNITY_CONTACT_VERSION = "2026-11-22-v2";
export const COMMUNITY_CONTACT_CONSENT = {
  codex: "Autorizo o uso dos dados informados para registrar minha inscrição e liberar a gravação do Codex Community Workshop da Apogee.",
} as const;
export type ContactCampaign = keyof typeof COMMUNITY_CONTACT_CONSENT;
