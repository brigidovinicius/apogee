import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const issuer = "https://auth.synthetic.invalid";
const otherIssuer = "https://other.synthetic.invalid";
const serverUrl = "https://mcp.synthetic.invalid/mcp";

// Use the SDK resolved by this application's shadcn, never a neighboring checkout.
export async function mcpOAuthSecurityTests(packageJsonUrl) {
  const applicationRequire = createRequire(packageJsonUrl);
  const require = createRequire(applicationRequire.resolve("shadcn"));
  const sdkRoot = resolve(dirname(require.resolve("@modelcontextprotocol/sdk/client/auth.js")), "../../..");
  for (const format of ["cjs", "esm"]) {
    const load = name => import(pathToFileURL(resolve(sdkRoot, `dist/${format}/client/${name}.js`)).href);
    const { auth, fetchToken } = await load("auth");
    const { ClientCredentialsProvider } = await load("auth-extensions");

    // Supply synthetic cached discovery and replace only the HTTP boundary.
    // SDK credential handling, serialization and token parsing run for real.
    const fixture = (authorizationServer, { clientIssuer = issuer, tokenIssuer = issuer } = {}) => {
      const requests = [];
      let storedTokens = { access_token: "synthetic-old-access", token_type: "Bearer", refresh_token: "synthetic-refresh", issuer: tokenIssuer };
      const provider = {
        redirectUrl: "https://client.synthetic.invalid/callback",
        clientMetadata: { redirect_uris: ["https://client.synthetic.invalid/callback"], token_endpoint_auth_method: "client_secret_basic" },
        clientInformation: () => ({ client_id: "synthetic-client", client_secret: "synthetic-secret", issuer: clientIssuer }),
        tokens: () => storedTokens,
        saveTokens: value => { storedTokens = JSON.parse(JSON.stringify(value)); },
        saveCodeVerifier: () => {},
        redirectToAuthorization: () => {},
        discoveryState: () => ({
          authorizationServerUrl: authorizationServer,
          resourceMetadata: { resource: serverUrl, authorization_servers: [authorizationServer] },
          authorizationServerMetadata: {
            issuer: authorizationServer, authorization_endpoint: `${authorizationServer}/authorize`, token_endpoint: `${authorizationServer}/token`,
            response_types_supported: ["code"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_basic"],
          },
        }),
      };
      const fetchFn = async (url, init) => {
        requests.push({ url: String(url), method: init.method, authorization: new Headers(init.headers).get("authorization"), body: String(init.body) });
        return Response.json({ access_token: "synthetic-new-access", token_type: "Bearer", refresh_token: "synthetic-new-refresh" });
      };
      return { provider, fetchFn, requests };
    };

    test(`${format}: auth never posts a refresh token to a different issuer`, async () => {
      const f = fixture(otherIssuer, { clientIssuer: otherIssuer });
      const result = await auth(f.provider, { serverUrl, fetchFn: f.fetchFn });
      assert.equal(result, "REDIRECT");
      assert.deepEqual(f.requests, []);
    });

    test(`${format}: fetchToken rejects client credentials bound to another issuer before HTTP`, async () => {
      const f = fixture(otherIssuer);
      f.provider.prepareTokenRequest = () => new URLSearchParams({ grant_type: "client_credentials" });
      await assert.rejects(() => fetchToken(f.provider, otherIssuer, { fetchFn: f.fetchFn }));
      assert.deepEqual(f.requests, []);
    });

    test(`${format}: bundled expectedIssuer prevents a server-selected credential destination`, async () => {
      const f = fixture(otherIssuer);
      const provider = new ClientCredentialsProvider({ clientId: "synthetic-client", clientSecret: "synthetic-secret", expectedIssuer: issuer });
      provider.discoveryState = f.provider.discoveryState;
      await assert.rejects(() => auth(provider, { serverUrl, fetchFn: f.fetchFn }));
      assert.deepEqual(f.requests, []);
    });

    test(`${format}: legitimate refresh persists the issuer through JSON storage`, async () => {
      const f = fixture(issuer);
      assert.equal(await auth(f.provider, { serverUrl, fetchFn: f.fetchFn }), "AUTHORIZED");
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, "https://auth.synthetic.invalid/token");
      assert.equal(f.requests[0].method, "POST");
      assert.equal(new URLSearchParams(f.requests[0].body).get("refresh_token"), "synthetic-refresh");
      assert.equal(f.provider.tokens().issuer, "https://auth.synthetic.invalid");
      assert.equal(f.provider.tokens().access_token, "synthetic-new-access");
    });

    test(`${format}: bundled client credentials still work with their expected issuer`, async () => {
      const f = fixture(issuer);
      const provider = new ClientCredentialsProvider({ clientId: "synthetic-client", clientSecret: "synthetic-secret", expectedIssuer: issuer });
      provider.discoveryState = f.provider.discoveryState;
      assert.equal(await auth(provider, { serverUrl, fetchFn: f.fetchFn }), "AUTHORIZED");
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, "https://auth.synthetic.invalid/token");
      assert.equal(f.requests[0].authorization, `Basic ${Buffer.from("synthetic-client:synthetic-secret").toString("base64")}`);
      assert.equal(new URLSearchParams(f.requests[0].body).get("grant_type"), "client_credentials");
      assert.equal(provider.tokens().access_token, "synthetic-new-access");
    });
  }
}
