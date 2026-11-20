// Only a public hostname is used to look up a site icon. Paths and queries stay private.
export function brandDomain(value: string) {
  const host = value.toLowerCase().replace(/^www\./, "");
  if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  if (/\.(?:local|localhost|internal|test|invalid|example|onion|arpa)$/.test(host)) return null;
  return host;
}

export function productDomain(href: string) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = brandDomain(url.hostname);
  // An item hosted in a shared directory should not inherit the directory's brand.
  if (host && url.pathname !== "/" && /(^|\.)(github\.com|gitlab\.com|notion\.(so|com)|google\.com|labs\.google|perkbook\.com|linktr\.ee)$/.test(host)) return null;
  return host;
}
