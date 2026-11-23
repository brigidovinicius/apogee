import { normalizeOpportunitySearch } from "./search";
import type { StudentOpportunity } from "./types";

// The organizer field and the official announcement must identify the same company.
const organizers: readonly { names: readonly string[]; domains: readonly string[] }[] = [
  { names: ["openai", "openai academy"], domains: ["openai.com"] },
  { names: ["google", "google cloud", "google for developers"], domains: ["google.com", "google.com.br", "google.dev"] },
  { names: ["microsoft", "microsoft reactor"], domains: ["microsoft.com"] },
  { names: ["aws", "amazon web services"], domains: ["aws.amazon.com", "aws.com"] },
  { names: ["github", "github education"], domains: ["github.com", "githubuniverse.com"] },
  { names: ["nvidia", "nvidia developer"], domains: ["nvidia.com"] },
  { names: ["apple", "apple developer"], domains: ["apple.com"] },
  { names: ["meta", "meta for developers"], domains: ["meta.com", "developers.facebook.com"] },
  { names: ["ibm", "ibm developer"], domains: ["ibm.com"] },
  { names: ["oracle", "oracle developer"], domains: ["oracle.com"] },
  { names: ["salesforce", "trailhead by salesforce"], domains: ["salesforce.com"] },
  { names: ["totvs"], domains: ["totvs.com"] },
  { names: ["vtex"], domains: ["vtex.com", "vtexday.com.br"] },
  { names: ["rd station"], domains: ["rdstation.com", "rdsummit.com.br"] },
  { names: ["rocketseat"], domains: ["rocketseat.com.br"] },
  { names: ["alura"], domains: ["alura.com.br"] },
  { names: ["dio", "digital innovation one"], domains: ["dio.me"] },
  { names: ["ifood", "ifood tecnologia"], domains: ["ifood.com.br"] },
  { names: ["nubank", "nu"], domains: ["nubank.com.br", "nu.com.br"] },
];
const organizerDomains = new Map(organizers.flatMap(({ names, domains }) => names.map(name => [name, domains] as const)));

export function technologyEventOrganizer(item: Pick<StudentOpportunity, "organization" | "officialUrl">) {
  const domains = organizerDomains.get(normalizeOpportunitySearch(item.organization));
  if (!domains) return false;
  const url = URL.parse(item.officialUrl);
  return url?.protocol === "https:" && domains.some(domain =>
    url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}
