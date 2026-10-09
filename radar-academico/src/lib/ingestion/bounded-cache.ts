export class BoundedCache<T> {
  private values = new Map<string, { value: T; bytes: number; until: number }>();
  private bytes = 0;
  constructor(private maxEntries: number, private maxBytes: number, private ttlMs: number) {}
  private remove(key: string) {
    this.bytes -= this.values.get(key)?.bytes ?? 0;
    this.values.delete(key);
  }
  get(key: string, now = Date.now()): T | undefined {
    const entry = this.values.get(key);
    if (!entry) return;
    if (entry.until <= now) { this.remove(key); return; }
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, bytes: number, now = Date.now()) {
    this.remove(key);
    if (bytes > this.maxBytes) return;
    for (const [id, entry] of this.values) if (entry.until <= now) this.remove(id);
    while (this.values.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    this.values.set(key, { value, bytes, until: now + this.ttlMs });
    this.bytes += bytes;
  }
}
