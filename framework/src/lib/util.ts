import type { Platform } from '@/db/types';

export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return prefix ? `${prefix}_${rand}` : rand;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Lowercased, punctuation-free form used for duplicate detection. */
export function normalizeName(input: string): string {
  return slugify(input).replace(/-/g, ' ').trim();
}

export function detectPlatform(url: string): Platform {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return 'other';
  }
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) return 'youtube';
  if (host.endsWith('tiktok.com')) return 'tiktok';
  if (host.endsWith('vimeo.com')) return 'vimeo';
  if (host === 'x.com' || host.endsWith('twitter.com')) return 'x';
  if (host.endsWith('threads.net') || host.endsWith('threads.com')) return 'threads';
  return 'web';
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function instagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/([\w-]+)/);
  return m ? m[1] : null;
}

/**
 * Canonical form of a URL for duplicate detection: strips tracking params,
 * fragments and trailing slashes; reduces YouTube/Instagram to their IDs.
 */
export function canonicalUrl(url: string): string {
  const trimmed = url.trim();
  const yt = youtubeId(trimmed);
  if (yt) return `youtube:${yt}`;
  const ig = instagramShortcode(trimmed);
  if (ig) return `instagram:${ig}`;
  try {
    const u = new URL(trimmed);
    u.hash = '';
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      if (!/^(utm_|fbclid|gclid|igsh|si$|ref$|feature$)/i.test(k)) keep.set(k, v);
    });
    const q = keep.toString();
    const host = u.hostname.replace(/^www\.|^m\./, '');
    return `${host}${u.pathname.replace(/\/+$/, '')}${q ? `?${q}` : ''}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Link that opens the source at a timestamp, where the platform supports it. */
export function urlAtTime(url: string, seconds: number | null | undefined): string {
  if (seconds == null) return url;
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/watch?v=${yt}&t=${Math.floor(seconds)}s`;
  if (detectPlatform(url) === 'vimeo') return `${url.split('#')[0]}#t=${Math.floor(seconds)}s`;
  return url;
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m).padStart(2, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

/** Parses "1:02:03", "02:40", "90", "1m30s". Returns null for blank/invalid. */
export function parseTime(input: string): number | null {
  const v = input.trim();
  if (!v) return null;
  const hms = v.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return (Number(hms[1] ?? 0) * 3600) + (Number(hms[2] ?? 0) * 60) + Number(hms[3] ?? 0);
  }
  const parts = v.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function platformLabel(p: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    vimeo: 'Vimeo',
    x: 'X',
    threads: 'Threads',
    web: 'Web',
    local: 'Local file',
    other: 'Other',
  };
  return map[p] ?? p;
}

export function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < day * 30) return `${Math.floor(diff / day)} d ago`;
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatBytes(n: number | undefined): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${units[i]}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Trigram similarity between two strings, 0..1. */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = `  ${normalizeName(s)} `;
    const out = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((g) => B.has(g) && inter++);
  return (2 * inter) / (A.size + B.size);
}

export function present<T>(xs: (T | undefined | null)[]): T[] {
  return xs.filter((x): x is T => x != null);
}
