import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { expect, it, vi } from "vitest";
vi.mock("node:https", () => ({ request: vi.fn() }));
import { request } from "node:https";
import { publicLookup, safeRequest } from "@/lib/ingestion/safe-request";

it("pins the actual HTTPS socket lookup, preserves hostname and destroys overflowing streams", async () => {
  let response: Readable;
  vi.mocked(request).mockImplementation(((url: URL, options: { lookup: unknown; agent: unknown; signal: AbortSignal; headers: Record<string, string> }, callback: (res: Readable) => void) => {
    expect(url.hostname).toBe("example.edu.br");
    expect(options.lookup).toBe(publicLookup);
    expect(options.agent).toBe(false);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers["Accept-Encoding"]).toBe("identity");
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      response = Object.assign(Readable.from([Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(100)]), { statusCode: 200, headers: {} });
      callback(response);
    };
    return req;
  }) as never);
  await expect(safeRequest("https://example.edu.br/file", {}, 5)).rejects.toThrow("limite");
  expect(response!.destroyed).toBe(true);
});

it("rejects literal private targets and non-HTTPS before creating a socket", async () => {
  vi.mocked(request).mockClear();
  for (const url of ["http://example.edu.br", "https://127.0.0.1", "https://[::1]", "https://example.edu.br:8443", "https://u:p@example.edu.br"]) {
    await expect(safeRequest(url, {}, 10)).rejects.toThrow();
  }
  expect(request).not.toHaveBeenCalled();
});

it("accepts a compressed 404 without reading its body, but rejects compressed success", async () => {
  let status = 404;
  let response: Readable;
  vi.mocked(request).mockImplementation(((_url: URL, _options: unknown, callback: (res: Readable) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      response = Object.assign(Readable.from([Buffer.alloc(100)]), {
        statusCode: status,
        headers: { "content-encoding": "gzip" },
      });
      callback(response);
    };
    return req;
  }) as never);

  const missing = await safeRequest("https://example.edu.br/robots.txt", {}, 5);
  expect(missing.status).toBe(404);
  expect(await missing.text()).toBe("");
  expect(response!.destroyed).toBe(true);

  status = 200;
  await expect(safeRequest("https://example.edu.br/page", {}, 5)).rejects.toThrow("fora dos limites");
  expect(response!.destroyed).toBe(true);
});
