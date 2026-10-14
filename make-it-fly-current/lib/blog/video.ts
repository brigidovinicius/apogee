export type VideoEmbed = { provider: "YouTube" | "Vimeo"; src: string };

export function parseVideoUrl(value: string): VideoEmbed | null {
  if (!value || value.length > 300) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be" && /^\/[a-zA-Z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split("/")[1];
  if (host === "www.youtube.com" || host === "youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (/^\/(?:shorts|embed)\/[a-zA-Z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split("/")[2];
  }
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  if ((host === "vimeo.com" || host === "www.vimeo.com") && /^\/\d{5,15}\/?$/.test(url.pathname)) {
    return { provider: "Vimeo", src: `https://player.vimeo.com/video/${url.pathname.split("/")[1]}` };
  }
  return null;
}
