import { getSql } from "@/lib/members/db";
import { brandDomain, productDomain } from "@/lib/brand/domain";

const missing = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let host = brandDomain(params.get("site") ?? "");
  const offer = params.get("beneficio");
  if (offer !== null) {
    if (params.has("site") || !/^[a-zA-Z0-9_-]{1,100}$/.test(offer)) return missing();
    // Only consult the editorial source of a currently public offer. Redemption URLs stay private.
    const [row] = await getSql()<{ source_url: string; partner: string }[]>`
      select o.source_url, b.partner from member_benefit b
      join member_benefit_organization o on o.benefit_id=b.id
      where b.id=${offer} and public.member_benefit_is_available(b)`;
    host = row && productDomain(row.source_url);
    // Partner catalogues sometimes cite an intermediary's site as their source.
    if (host && row) {
      const words = row.partner.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
      if (!words.some(word => word.length > 1 && host!.split(".").slice(0, -1).some(label => label.includes(word)))) return missing();
    }
  }
  if (!host) return missing();
  // The only network destination is this fixed image service, never the supplied hostname.
  const url = new URL("https://t0.gstatic.com/faviconV2");
  url.search = new URLSearchParams({ client: "SOCIAL", type: "FAVICON", fallback_opts: "TYPE,SIZE,URL", size: "64", url: "http://" + host }).toString();
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") return missing();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length > 65536 || !png.every((byte, i) => bytes[i] === byte)) return missing();
    return new Response(bytes, { headers: { "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
