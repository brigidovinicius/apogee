import type { HexclaveConfig } from "@hexclave/next";

// Configuração declarativa a ser comparada com o projeto Cloud antes de um
// futuro push. Credenciais Google e domínios confiáveis são deliberadamente
// ausentes: são valores específicos do ambiente no painel Hexclave.
export const config: HexclaveConfig = {
  apps: {
    installed: {
      authentication: { enabled: true },
      payments: { enabled: true },
      emails: { enabled: true },
      "data-vault": { enabled: true },
      analytics: { enabled: true },
    },
  },
  auth: {
    password: {
      allowSignIn: true,
    },
    otp: {
      allowSignIn: true,
    },
    passkey: {
      allowSignIn: true,
    },
    oauth: {
      accountMergeStrategy: "link_method",
      providers: {
        google: {
          type: "google",
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
        github: {
          type: "github",
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
        microsoft: {
          type: "microsoft",
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
      },
    },
  },
  emails: {
    selectedThemeId: "1df07ae6-abf3-4a40-83a5-a1a2cbe336ac",
  },
};
