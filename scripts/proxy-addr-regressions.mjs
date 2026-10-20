import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Test the package resolved by Express, the actual consumer in shadcn's tooling.
export function proxyAddrSecurityTests(packageJsonUrl) {
  const require = createRequire(packageJsonUrl);
  const express = require("express");
  const expressRequire = createRequire(require.resolve("express/package.json"));
  const proxyaddr = expressRequire("proxy-addr");

  test("short mapped or zero-prefix IPv6 subnets cannot trust arbitrary IPv4 peers", () => {
    for (const subnet of ["::ffff:10.0.0.0/8", "::ffff:0.0.0.0/95", "::/1"]) {
      const trust = proxyaddr.compile([subnet]);
      assert.equal(trust("198.51.100.23"), false);
      assert.equal(trust("::ffff:198.51.100.23"), false);
    }
  });
  test("untrusted IPv4 and mapped sockets cannot inject a forwarded client identity", () => {
    for (const remoteAddress of ["198.51.100.23", "::ffff:198.51.100.23"]) {
      const request = { socket: { remoteAddress }, headers: { "x-forwarded-for": "203.0.113.99" } };
      assert.equal(proxyaddr(request, ["::ffff:10.0.0.0/8"]), remoteAddress);
    }
  });
  test("correct IPv4, mapped /104 and native IPv6 trust policies keep working", () => {
    for (const subnet of ["10.0.0.0/8", "::ffff:10.0.0.0/104"]) {
      const trust = proxyaddr.compile([subnet]);
      assert.equal(trust("10.2.3.4"), true); assert.equal(trust("::ffff:10.2.3.4"), true);
      assert.equal(trust("198.51.100.23"), false);
      const request = { socket: { remoteAddress: "10.2.3.4" }, headers: { "x-forwarded-for": "203.0.113.99" } };
      assert.equal(proxyaddr(request, trust), "203.0.113.99");
    }
    const trust = proxyaddr.compile(["2001:db8::/32"]);
    assert.equal(trust("2001:db8::1"), true); assert.equal(trust("::1"), false);
  });
  test("real Express refuses forged X-Forwarded-For under a short mapped trust subnet", async () => {
    const app = express(); app.set("trust proxy", "::ffff:10.0.0.0/8");
    app.get("/", (request, response) => response.json({ ip: request.ip, ips: request.ips }));
    const server = await new Promise(resolve => { const owned = app.listen(0, "127.0.0.1", () => resolve(owned)); });
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
        headers: { "x-forwarded-for": "203.0.113.99" }, signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ip: "127.0.0.1", ips: [] });
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}
