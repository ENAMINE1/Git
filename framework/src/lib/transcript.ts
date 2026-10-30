import type { TranscriptSegment } from '@/db/types';
import { parseTime } from './util';

const CUE = /^(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*-->\s*/;
const LEAD = /^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–—:|]?\s*(.*)$/;

function cueStart(line: string): number | null {
  const start = line.split('-->')[0].trim().replace(',', '.');
  const [hms, frac] = start.split('.');
  const base = parseTime(hms);
  return base == null ? null : base + (frac ? Number(`0.${frac}`) : 0);
}

/**
 * Parses pasted captions into timestamped segments. Accepts WebVTT, SRT,
 * or plain lines that start with a timestamp ("02:40 Masking…"). Lines with
 * no timestamp are kept with t = null — timestamps are never guessed.
 */
export function parseTranscript(raw: string): TranscriptSegment[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const isCues = lines.some((l) => CUE.test(l.trim()));
  const out: TranscriptSegment[] = [];
  if (isCues) {
    let t: number | null = null;
    let buf: string[] = [];
    const flush = () => {
      const text = buf.join(' ').replace(/<[^>]+>/g, '').trim();
      if (text) out.push({ t, text });
      buf = [];
    };
    for (const line of lines) {
      const l = line.trim();
      if (!l || l === 'WEBVTT' || /^NOTE\b/.test(l) || /^\d+$/.test(l)) {
        if (!l) flush();
        continue;
      }
      if (CUE.test(l)) {
        flush();
        t = cueStart(l);
        continue;
      }
      buf.push(l);
    }
    flush();
    // Auto-captions repeat lines across cues; drop consecutive duplicates.
    return out.filter((s, i) => i === 0 || s.text !== out[i - 1].text);
  }
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(LEAD);
    if (m && parseTime(m[1]) != null) out.push({ t: parseTime(m[1]), text: m[2].trim() });
    else out.push({ t: null, text: l });
  }
  return out;
}

/** Chapter lists ("00:00 Intro") → step drafts. Ignores lines without a timestamp. */
export function parseChapters(raw: string): { t: number; label: string }[] {
  return parseTranscript(raw)
    .filter((s): s is { t: number; text: string } => s.t != null && !!s.text)
    .map((s) => ({ t: s.t, label: s.text }));
}
