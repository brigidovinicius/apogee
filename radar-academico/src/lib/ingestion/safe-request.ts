import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import type { LookupFunction } from "node:net";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(network, prefix, "ipv4");
// Only global unicast IPv6, excluding special-purpose/tunnelling/documentation.
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

// Validate ALL answers and supply the validated address to the actual socket.
// This avoids a second DNS lookup (DNS rebinding); TLS still verifies the hostname.
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  void lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      callback(new Error("Destino de rede não permitido"), "", 4);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  }, () => callback(new Error("Falha na resolução da fonte"), "", 4));
};

export async function collectBounded(stream: AsyncIterable<Uint8Array>, maxBytes: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new Error("Arquivo excede o limite configurado");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

// No proxy environment, redirects, connection reuse, cookies or decompression.
// A single deadline covers DNS, TLS, headers and streaming body consumption.
export function safeRequest(url: string, headers: Record<string, string>, maxBytes: number, method = "GET"): Promise<Response> {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.port && target.port !== "443" || target.username || target.password || isIP(target.hostname.replace(/^\[|\]$/g, ""))) {
    return Promise.reject(new Error("URL de rede não permitida"));
  }
  return new Promise((resolve, reject) => {
    const req = request(target, {
      method, headers: { ...headers, "Accept-Encoding": "identity" },
      agent: false, lookup: publicLookup, signal: AbortSignal.timeout(15_000),
    }, (response) => {
      void (async () => {
        const status = response.statusCode ?? 502;
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        if (method === "HEAD" || status === 204 || status === 304 || status >= 300 && status < 400) {
          response.destroy();
          resolve(new Response(null, { status, headers: responseHeaders }));
          return;
        }
        const encoding = responseHeaders.get("content-encoding");
        const declared = responseHeaders.get("content-length");
        if (encoding && encoding !== "identity" || declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
          throw new Error("Resposta da fonte fora dos limites");
        }
        const body = await collectBounded(response, maxBytes);
        resolve(new Response(new Uint8Array(body), { status, headers: responseHeaders }));
      })().catch((error: unknown) => { response.destroy(); reject(error); });
    });
    req.on("error", () => reject(new Error("Falha ao consultar fonte oficial")));
    req.end();
  });
}
