import { parseVideoUrl } from "@/lib/blog/video";

/** Recording of the Codex Community Workshop (21/11/2026). */
export const EVENT_LIVE_PATH = "/evento-openai/ao-vivo";
export const EVENT_LIVE_URL = "https://www.youtube.com/watch?v=msc2Hz8Uuzc";
export const EVENT_LIVE_EMBED = parseVideoUrl(EVENT_LIVE_URL)!.src;
