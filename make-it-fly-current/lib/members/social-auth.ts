const GOOGLE_OAUTH_ERRORS: Record<string, string> = {
  access_denied: "A autorização com o Google foi cancelada.",
  // Better Auth usa estes códigos textuais no callback OAuth; mantemos as
  // versões antigas com sublinhado para não degradar uma tentativa iniciada
  // antes de uma atualização da biblioteca.
  "account not linked": "Já existe uma conta com este e-mail. Entre com e-mail e senha.",
  account_not_linked: "Já existe uma conta com este e-mail. Entre com e-mail e senha.",
  email_not_verified: "Use uma conta Google com e-mail verificado.",
  "signup disabled": "Crie sua conta com Google pela página de cadastro.",
  signup_disabled: "Crie sua conta com Google pela página de cadastro.",
};

// Nunca exibimos a descrição recebida do provedor ou da API: ela pode conter
// detalhes operacionais que não ajudam a pessoa a concluir o login.
export function googleOAuthErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "string") return undefined;
  return GOOGLE_OAUTH_ERRORS[error] ?? "Não foi possível concluir a entrada com Google. Tente novamente.";
}
