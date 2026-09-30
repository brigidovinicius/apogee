export type ApplicationValues = {
  name: string;
  email: string;
  phone: string;
  age: string;
  profession: string;
  hasIdea: boolean | null;
  ideaDescription: string;
  hasLaptop: boolean | null;
  usesPaidAI: boolean | null;
  website: string;
};

export type FieldErrors = Partial<Record<keyof ApplicationValues, string>>;
export type Attribution = Partial<Record<"utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "referrer", string>>;

const attributionKey = "makeitfly:attribution:v1";
const utmFields = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
} as const;

export function validateStep(values: ApplicationValues, step: number): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    if (values.name.trim().length < 2 || values.name.trim().length > 120) errors.name = "Conte seu nome, com pelo menos 2 caracteres.";
    if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Informe um e-mail válido, como nome@exemplo.com.";
    const digits = values.phone.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(values.phone.trim()) || digits.length < 10 || digits.length > 15) errors.phone = "Informe o telefone com DDD, com 10 a 15 dígitos.";
    const age = Number(values.age);
    if (!/^\d{1,3}$/.test(values.age.trim()) || !Number.isInteger(age) || age < 1 || age > 120) errors.age = "Informe sua idade em anos completos.";
    if (values.profession.trim().length < 2 || values.profession.trim().length > 160) errors.profession = "Conte sua profissão ou área de atuação, com até 160 caracteres.";
  }
  if (step === 1) {
    if (typeof values.hasIdea !== "boolean") errors.hasIdea = "Escolha uma das opções para continuar.";
    if (values.hasIdea && values.ideaDescription.length > 2000) errors.ideaDescription = "Use até 2.000 caracteres para contar sua ideia.";
  }
  if (step === 2) {
    if (typeof values.hasLaptop !== "boolean") errors.hasLaptop = "Escolha uma das opções antes de enviar.";
    if (typeof values.usesPaidAI !== "boolean") errors.usesPaidAI = "Escolha uma das opções antes de enviar.";
  }
  return errors;
}

export function attributionFromUrl(search: string, referrer: string): Attribution {
  const result: Attribution = {};
  const params = new URLSearchParams(search);
  for (const [query, field] of Object.entries(utmFields)) {
    const value = params.get(query)?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
    if (value) result[field] = value;
  }
  try {
    const url = new URL(referrer);
    // Keep only the source origin; paths and queries may contain personal data.
    if (url.protocol === "https:" || url.protocol === "http:") result.referrer = url.origin;
  } catch { /* A direct visit has no referrer. */ }
  return result;
}

export function rememberAttribution() {
  try {
    sessionStorage.setItem(attributionKey, JSON.stringify({ at: Date.now(), values: attributionFromUrl(window.location.search, document.referrer) }));
  } catch { /* Participation still works when browser storage is unavailable. */ }
}

export function readAttribution(): Attribution {
  const current = attributionFromUrl(window.location.search, document.referrer);
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(attributionKey) || "null");
    if (saved && typeof saved === "object" && "at" in saved && "values" in saved
      && typeof saved.at === "number" && Date.now() - saved.at >= 0 && Date.now() - saved.at < 30 * 60 * 1000
      && saved.values && typeof saved.values === "object") {
      const previous: Attribution = {};
      for (const field of [...Object.values(utmFields), "referrer"] as const) {
        const value = (saved.values as Record<string, unknown>)[field];
        if (typeof value === "string") previous[field] = value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
      }
      if (current.referrer === window.location.origin && previous.referrer) delete current.referrer;
      return { ...previous, ...current };
    }
  } catch { /* Direct visits and disabled storage need no stored attribution. */ }
  return current;
}
