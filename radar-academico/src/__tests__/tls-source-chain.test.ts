import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import { expect, it } from "vitest";

it("uses the SSL.com intermediate signed by Node's existing 2022 root", () => {
  const intermediate = new X509Certificate(readFileSync(new URL("../../certs/sslcom-tls-issuing-rsa-ca-r1.pem", import.meta.url)));
  const root = rootCertificates.map((pem) => new X509Certificate(pem))
    .find((certificate) => certificate.subject.includes("CN=SSL.com TLS RSA Root CA 2022"));
  expect(root).toBeDefined();
  expect(intermediate.fingerprint256).toBe("BF:BC:39:E9:FA:2B:84:C9:A9:23:37:E2:34:4E:E2:38:1D:8D:3D:3A:E8:EA:75:EF:4E:48:E5:80:7E:D8:0C:69");
  expect(intermediate.issuer).toContain("CN=SSL.com TLS RSA Root CA 2022");
  expect(intermediate.verify(root!.publicKey)).toBe(true);
});
