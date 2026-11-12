export function assertString(val: unknown, maxLen = 2000): string {
  if (typeof val !== 'string' || val.length > maxLen) return '';
  return val;
}

export function assertArray(val: unknown, maxLen = 100): unknown[] {
  if (!Array.isArray(val) || val.length > maxLen) return [];
  return val;
}

export function assertNumber(val: unknown, min = 0, max = 100000): number {
  if (typeof val !== 'number' || isNaN(val) || val < min || val > max) return min;
  return val;
}

export function assertEnum<T extends string>(val: unknown, allowed: readonly T[], defaultVal: T): T {
  if (allowed.includes(val as T)) return val as T;
  return defaultVal;
}

export function sanitizeStr(val: string): string {
  return val.replace(/[<>"'&]/g, '').trim().substring(0, 2000);
}

/**
 * Accept only public http(s) URLs.
 *
 * Scraped targets are fetched by the server, so an unchecked URL would let a
 * user point the scraper at the cloud metadata endpoint or something on the
 * internal network. Only public hosts are allowed.
 */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;

  // IPv4-mapped IPv6 (::ffff:169.254.169.254) reaches the same host.
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    const octets = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
    if (!isPublicIpv4(octets)) return false;
  } else if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) {
    const octets = host.split('.').map((n) => Number(n));
    if (!isPublicIpv4(octets)) return false;
  } else {
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
      return false;
    }
    if (host === '::' || host === '::1') return false;
    // Unique-local IPv6 (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return false;
    if (/^fe[89ab][0-9a-f]:/.test(host)) return false;
  }
  return true;
}

/** True when the address is routable on the public internet. */
function isPublicIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;            // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return false;  // private
  if (a === 192 && b === 168) return false;            // private
  if (a === 100 && b >= 64 && b <= 127) return false;  // carrier-grade NAT
  if (a >= 224) return false;                         // multicast / reserved
  return true;
}

/** Keep only well-formed public URLs, trimmed and de-duplicated. */
export function sanitizeTargetUrls(values: unknown[], max = 25): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!isPublicHttpUrl(trimmed)) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}
