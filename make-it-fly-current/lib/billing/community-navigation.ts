import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";

/** Only product destinations; never forward personal data, arbitrary queries or external URLs. */
export function communityReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || /[\\\u0000-\u001f]/.test(value)) return "/membros/oportunidades";
  if (value === "/membros" || value === "/membros/trilha" || value === "/membros/beneficios") return value;
  try {
    const u = new URL(value, "https://apogee.invalid");
    if (u.origin !== "https://apogee.invalid") return "/membros/oportunidades";
    if (/^\/membros\/beneficios(?:\/[A-Za-z0-9_-]{1,200})?$/.test(u.pathname)) {
      const filters = new URLSearchParams();
      for (const name of ["q", "categoria", "publico"]) {
        const value = u.searchParams.get(name);
        if (value && value.length <= 100 && !/[\\\u0000-\u001f]/.test(value)) filters.set(name, value);
      }
      return u.pathname + (filters.size ? `?${filters}` : "");
    }
    if (u.pathname === "/membros/ferramentas") {
      const category = u.searchParams.get("categoria");
      return u.pathname + (category && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category) && category.length <= 80 ? `?categoria=${category}` : "");
    }
  } catch { return "/membros/oportunidades"; }
  return radarDetailReturnPath(value);
}

export function toolboxReturnPath(category: string | null) {
  return communityReturnPath("/membros/ferramentas" + (category ? "?categoria=" + encodeURIComponent(category) : ""));
}

export function isAnnualPurchasePath(path: string) {
  return ["/membros/assinatura", "/membros/ativar-assinatura"].includes(path.split(/[?#]/, 1)[0]);
}

export function annualSummaryPath(resource: string) {
  return `/membros/assinatura?next=${encodeURIComponent(communityReturnPath(resource))}`;
}

export function annualResourceLabel(path: string) {
  if (path.startsWith("/membros/meu-calendario/salvar/")) return "Salvar a oportunidade na agenda";
  if (path.startsWith("/membros/oportunidades/")) return "Abrir a oportunidade";
  if (path.startsWith("/membros/oportunidades")) return "Continuar no Radar";
  if (path.startsWith("/membros/ferramentas")) return "Abrir Caixa de Ferramentas";
  if (path === "/membros/trilha") return "Continuar na Trilha";
  if (path === "/membros/beneficios") return "Ver benefícios";
  if (path.startsWith("/membros/meu-calendario")) return "Abrir minha agenda";
  if (path.startsWith("/membros/colecoes")) return "Abrir minhas coleções";
  return "Abrir meus recursos";
}
