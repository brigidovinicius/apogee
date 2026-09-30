const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const RESERVED_PATHS = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct"]);

export function normalizeInstagram(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  let handle = input.startsWith("@") ? input.slice(1) : input;
  if (/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i.test(input)) {
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      if (!["https:", "http:"].includes(url.protocol) || !["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname.toLowerCase()) || url.port || url.username || url.password) return null;
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length !== 1) return null;
      handle = segments[0];
    } catch {
      return null;
    }
  }

  if (!HANDLE.test(handle) || RESERVED_PATHS.has(handle.toLowerCase()) || /^\.+$/.test(handle)) return null;
  return handle;
}
