import "server-only";
import { readFile, stat } from "node:fs/promises";
import { headers } from "next/headers";
import { Reader, type CityResponse } from "mmdb-lib";
import { memberClientIp } from "@/lib/members/client-ip";
import { BRAZILIAN_STATE_CODES, normalizeBrazilianLocation, type CanonicalBrazilianLocation } from "./location";
import { normalizeOpportunitySearch } from "./search";

const stateNames: Record<(typeof BRAZILIAN_STATE_CODES)[number], string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
const stateCodesByName = new Map(BRAZILIAN_STATE_CODES.map(code => [normalizeOpportunitySearch(stateNames[code]), code]));
stateCodesByName.set("federal district", "DF");
const maxDatabaseBytes = 200 * 1024 * 1024;
let database: Promise<Reader<CityResponse> | null> | undefined;

async function readDatabase(path: string) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > maxDatabaseBytes) return null;
    const reader = new Reader<CityResponse>(await readFile(path));
    return reader.metadata.databaseType === "DBIP-City-Lite" ? reader : null;
  } catch {
    return null;
  }
}

export function approximateBrazilianLocation(record: CityResponse | null): CanonicalBrazilianLocation | undefined {
  if (record?.country?.iso_code !== "BR") return;
  const names = record.subdivisions?.[0]?.names;
  const stateCode = stateCodesByName.get(normalizeOpportunitySearch(names?.["pt-BR"] ?? names?.en ?? ""));
  const city = record.city?.names;
  const result = normalizeBrazilianLocation({ stateCode, cityName: city?.["pt-BR"] ?? city?.en });

  return result.status === "valid" ? result.location : undefined;
}

export function radarLocationConfigured() {
  return Boolean(process.env.RADAR_DBIP_CITY_FILE?.trim());
}

export async function radarRequestLocation(): Promise<CanonicalBrazilianLocation | undefined> {
  const path = process.env.RADAR_DBIP_CITY_FILE?.trim();
  if (!path) return;
  const requestHeaders = await headers();
  if (requestHeaders.get("dnt") === "1" || requestHeaders.get("sec-gpc") === "1") return;

  // The same boundary as authentication ignores untrusted forwarding headers.
  const ip = memberClientIp(requestHeaders);
  if (!ip) return;
  database ??= readDatabase(path);
  const reader = await database;
  try {
    return approximateBrazilianLocation(reader?.get(ip) ?? null);
  } catch {
    return undefined;
  }
}
