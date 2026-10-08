import "server-only";

import { timingSafeEqual } from "node:crypto";

type Environment = Record<string, string | undefined>;

export function adminAuthorized(request: Request, env: Environment = process.env): boolean {
  const expected = env.APPLICATION_EXPORT_TOKEN ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
