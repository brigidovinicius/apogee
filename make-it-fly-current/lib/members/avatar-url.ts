const AVATAR_URL = /^\/api\/membros\/avatar\/([A-Za-z0-9_-]{1,128})\?v=[a-f0-9-]{36}$/;

// Não renderizamos URLs remotas recebidas de provedores de login como foto
// pública; somente imagens enviadas pelo membro e servidas pela Apogee.
export function memberAvatarUrl(value: string | null | undefined, ownerId: string): string | null {
  const match = value?.match(AVATAR_URL);
  return match && match[1] === ownerId ? value! : null;
}
