// Import only the existing, verified local OAuth client; never print credentials.
import assert from "node:assert/strict";
import {readFile,writeFile,chmod} from "node:fs/promises";
import {randomBytes} from "node:crypto";
const source=process.argv[2];
assert.ok(source,"Usage: node scripts/google-calendar-local-configure.mjs /absolute/path/client.json");
const client=JSON.parse(await readFile(source,"utf8")).web;
assert.equal(client?.client_id,"914658639835-earocvt248dibbrmp00cmfamh2qcs6qa.apps.googleusercontent.com","Only Apogee Local is allowed; production credentials are refused");
assert.equal(client.project_id,"apogee-oauth-local");
assert.ok(typeof client.client_secret==="string"&&client.client_secret.length>=16);
const target=new URL("../../.local/radar-calendar/google-calendar.json",import.meta.url);
let prior={};
try {prior=JSON.parse(await readFile(target,"utf8"));} catch(error){if(error.code!=="ENOENT")throw error;}
const config={
  marker:"apogee-google-calendar-local-v1",
  GOOGLE_CALENDAR_CLIENT_ID:client.client_id,
  GOOGLE_CALENDAR_CLIENT_SECRET:client.client_secret,
  GOOGLE_CALENDAR_ENCRYPTION_KEY:prior.GOOGLE_CALENDAR_ENCRYPTION_KEY||randomBytes(32).toString("hex"),
  GOOGLE_CALENDAR_SYNC_SECRET:prior.GOOGLE_CALENDAR_SYNC_SECRET||randomBytes(32).toString("hex"),
};
await writeFile(target,JSON.stringify(config,null,2)+"\n",{mode:0o600});await chmod(target,0o600);
console.log("Configuração privada local gravada. Reinicie o preview local para ativar o Google Agenda.");
