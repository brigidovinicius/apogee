import "server-only";
import { createHash } from "node:crypto";

// O subject do Google é estável por conta e não depende de dados que o usuário
// possa escolher. O hash evita publicar esse identificador no perfil, ao mesmo
// tempo que gera um username seguro para o fórum durante o primeiro cadastro.
export function googleUsernameFromSubject(subject: string): string {
  const digest = createHash("sha256").update(subject).digest("hex").slice(0, 20);
  return `google_${digest}`;
}
