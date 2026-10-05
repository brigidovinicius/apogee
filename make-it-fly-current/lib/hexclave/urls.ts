/** URLs locais usadas pelos redirecionamentos oficiais do Hexclave/Stack Auth. */
// Registrar exatamente este valor no OAuth Client do Google, no painel Google
// Cloud. Ele é operado pelo Stack Auth Cloud, não por uma Route Handler local.
export const googleOAuthCallbackUrl = "https://api.hexclave.com/api/v1/auth/oauth/callback/google";

export const hexclaveUrls = {
  default: { type: "hosted" as const },
  home: "/membros",
  signIn: "/login",
  afterSignIn: "/membros",
  afterSignUp: "/membros",
  afterSignOut: "/login",
};
