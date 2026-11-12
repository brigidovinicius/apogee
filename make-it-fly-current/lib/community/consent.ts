export const COMMUNITY_CONTACT_VERSION = "2026-11-12-v1";
export const COMMUNITY_CONTACT_CONSENT = {
  codex: "Quero receber por e-mail os avisos de acesso e disponibilidade do conteúdo do evento Codex Community organizado pela Apogee.",
} as const;
export type ContactCampaign = keyof typeof COMMUNITY_CONTACT_CONSENT;
