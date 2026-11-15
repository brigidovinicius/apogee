import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";

/** Only product destinations; never forward personal data, arbitrary queries or external URLs. */
export function communityReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || /[\\\u0000-\u001f]/.test(value)) return "/membros/oportunidades";
  if (value === "/membros" || value === "/membros/trilha" || value === "/membros/beneficios") return value;
  try {
    const u = new URL(value, "https://apogee.invalid");
    if (u.origin !== "https://apogee.invalid") return "/membros/oportunidades";
    if (u.pathname === "/membros/ferramentas") {
      const category = u.searchParams.get("categoria");
      return u.pathname + (category && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category) && category.length <= 80 ? `?categoria=${category}` : "");
    }
  } catch { return "/membros/oportunidades"; }
  return radarDetailReturnPath(value);
}
