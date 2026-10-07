import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

/**
 * O catálogo completo é uma integração servidor-a-servidor. Sem token válido,
 * a API falha fechada mesmo que a rede privada seja exposta por engano.
 */
export function isRadarConsumerAuthorized(request: Request): boolean {
  const expected = process.env.RADAR_ACADEMICO_API_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith(BEARER_PREFIX)) return false;

  const received = authorization.slice(BEARER_PREFIX.length);
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
