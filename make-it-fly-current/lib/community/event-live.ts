import { parseVideoUrl } from "@/lib/blog/video";

/** Online broadcast of the Codex Community Workshop (21/11/2026). */
export const EVENT_LIVE_PATH = "/evento-openai/ao-vivo";
export const EVENT_LIVE_REGISTERED_PATH = `${EVENT_LIVE_PATH}?inscricao=ok`;
export const EVENT_LIVE_URL = "https://www.youtube.com/live/innSLBAn8g8";
export const EVENT_LIVE_EMBED = parseVideoUrl(EVENT_LIVE_URL)!.src;
