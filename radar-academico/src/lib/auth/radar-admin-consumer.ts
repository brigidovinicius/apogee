import { secretMatches } from "@/lib/security";

const BEARER_PREFIX = "Bearer ";

/**
 * A ponte editorial é acessível somente pela aplicação Apogee na rede privada.
 * Ela usa uma credencial própria para que o token do catálogo de membros não
 * possa executar operações administrativas no Radar.
 */
export function isRadarAdminConsumerAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith(BEARER_PREFIX)) return false;

  return secretMatches(
    authorization.slice(BEARER_PREFIX.length),
    process.env.RADAR_ACADEMICO_ADMIN_API_TOKEN,
  );
}
