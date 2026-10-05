import type { HexclaveConfig } from "@hexclave/next";

// Configuração declarativa a ser comparada com o projeto Cloud antes de um
// futuro push. Credenciais Google e domínios confiáveis são deliberadamente
// ausentes: são valores específicos do ambiente no painel Hexclave.
export const config: HexclaveConfig = {
  apps: {
    installed: {
      authentication: { enabled: true },
    },
  },
  auth: {
    oauth: {
      accountMergeStrategy: "link_method",
      providers: {
        google: {
          type: "google",
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
      },
    },
  },
};
