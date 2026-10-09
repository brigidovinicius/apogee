import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export function secretMatches(received: string | null | undefined, expected: string | undefined) {
  if (!expected || !received || received.length > 4096) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

// Enable only when an isolated trusted proxy overwrites this single-IP header.
// Untrusted forwarded headers never identify a client; otherwise share a bucket.
export function trustedClientIp(headers: Headers): string | null {
  if (process.env.TRUST_PROXY_CLIENT_IP !== "true") return null;
  const ip = headers.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}

export class WindowLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(private limit: number, private windowMs: number, private capacity = 1024) {}
  take(key: string, now = Date.now()): boolean {
    for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
    const entry = this.entries.get(key);
    if (entry) {
      if (entry.count >= this.limit) return false;
      entry.count += 1;
    } else {
      // Fail closed at capacity; do not evict active rate limits.
      if (this.entries.size >= this.capacity) return false;
      this.entries.set(key, { count: 1, until: now + this.windowMs });
    }
    return true;
  }
}

export async function readLimitedBody(message: Request | Response, maxBytes: number, timeoutMs = 5000): Promise<Buffer> {
  const declared = message.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    void message.body?.cancel();
    throw new Error("Limite de corpo excedido");
  }
  if (!message.body) return Buffer.alloc(0);
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new Error("Tempo excedido")); void reader.cancel(); }, timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Limite de corpo excedido");
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    void reader.cancel();
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
