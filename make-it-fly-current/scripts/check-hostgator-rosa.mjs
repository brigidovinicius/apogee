import { createPrivateKey, sign } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { hostgatorProofBody, rosaCampaign } from "../lib/benefits/hostgator-proof.mjs";
import { sourceSession } from "./benefit-source-check.mjs";

const receiptEndpoint = "https://www.apogee.community/api/internal/beneficios/hostgator";
const args = process.argv.slice(2);
if (args.length > 1 || args.some(flag => flag !== "--send")) throw Error("Use a checagem simples ou --send.");
const send = args[0] === "--send";
const campaign = rosaCampaign(JSON.parse(await readFile(new URL("../content/benefit-offers.json", import.meta.url), "utf8")));
if (!campaign) throw Error("A campanha aprovada da Rosa está ausente.");
const keyFile = process.env.APOGEE_HOSTGATOR_KEY_FILE;
if (send && (!keyFile || (await stat(keyFile)).mode & 0o077)) throw Error("A chave do verificador deve ser privada.");
const result = await sourceSession()(campaign);
if (send && result.outcome !== "temporary") {
  const body = hostgatorProofBody(campaign, new Date().toISOString(), result.outcome);
  const key = createPrivateKey(await readFile(keyFile));
  if (key.asymmetricKeyType !== "ed25519") throw Error("A chave do verificador não é Ed25519.");
  const response = await fetch(receiptEndpoint, {
    method: "POST", body, redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", "x-apogee-proof": sign(null, body, key).toString("base64url") },
  });
  if (!response.ok) throw Error("A Apogee recusou a prova do verificador (" + response.status + ").");
}
console.log(JSON.stringify({ campaign: campaign.id, ...result, sent: send && result.outcome !== "temporary" }));
if (result.outcome !== "verified") process.exitCode = 1;
