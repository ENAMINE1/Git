import { describe, expect, it } from 'vitest';
import { parseChapters, parseTranscript } from '@/lib/transcript';

describe('transcript parsing', () => {
  it('parses WebVTT cues', () => {
    const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello <c>there</c>\n\n00:01:15.500 --> 00:01:18.000\nPrep the footage\n`;
    expect(parseTranscript(vtt)).toEqual([
      { t: 1, text: 'Hello there' },
      { t: 75.5, text: 'Prep the footage' },
    ]);
  });
  it('parses SRT', () => {
    const srt = `1\n00:00:02,000 --> 00:00:04,000\nFirst line\n\n2\n00:02:40,000 --> 00:02:44,000\nMasking\n`;
    expect(parseTranscript(srt).map((s) => s.t)).toEqual([2, 160]);
  });
  it('keeps untimed lines without inventing timestamps', () => {
    expect(parseTranscript('Just some notes\n02:40 Masking')).toEqual([
      { t: null, text: 'Just some notes' },
      { t: 160, text: 'Masking' },
    ]);
  });
  it('reads chapter lists', () => {
    expect(parseChapters('0:00 Intro\n1:15 - Footage prep\n[04:10] Camera tracking\nno time here')).toEqual([
      { t: 0, label: 'Intro' },
      { t: 75, label: 'Footage prep' },
      { t: 250, label: 'Camera tracking' },
    ]);
  });
});
