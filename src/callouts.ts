/**
 * callouts.ts — Shared callout markdown generators.
 * Imported by KirioView, EditorSuggesters, and QuickInsert modals.
 */

import { Highlight, YtAnnotation } from './types';

// ── Color → callout type map ──────────────────────────────────────────────
export const HEX_TO_CALLOUT: Record<string, string> = {
  '#fef08a': 'kirio-yellow',
  '#f9a8d4': 'kirio-pink',
  '#86efac': 'kirio-green',
  '#93c5fd': 'kirio-blue',
  '#fca5a5': 'kirio-red-highlight',
};

export const YT_LABELS: Record<string, { icon: string; label: string }> = {
  note:      { icon: '📝', label: 'Note' },
  question:  { icon: '❓', label: 'Question' },
  important: { icon: '⭐', label: 'Important' },
  idea:      { icon: '💡', label: 'Idea' },
};

export function getCalloutType(hexColor: string): string {
  return HEX_TO_CALLOUT[hexColor?.toLowerCase()] ?? 'kirio-yellow';
}

export function formatSeconds(sec: number): string {
  const s = Math.floor(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/**
 * > [!kirio-pink] [Page Title ↗](url#kirio-id)
 * > "Highlighted text"
 */
export function generateHighlightCallout(h: Highlight): string {
  const calloutType = h.color_tag?.startsWith('#')
    ? getCalloutType(h.color_tag)
    : 'kirio-yellow';
  const title = h.title
    || (() => { try { return new URL(h.url).hostname; } catch { return h.url; } })();
  const deepLink    = `${h.url}#kirio-${h.id}`;
  const escapedText = h.text.replace(/>/g, '\\>');
  return `> [!${calloutType}] [${title} ↗](${deepLink})\n> "${escapedText}"`;
}

/**
 * > [!kirio-red-annotation] [Video Title ↗](youtube.com/watch?v=ID&t=Ns)
 * > ⏱ 13:41 · ⭐ Important
 * > "Annotation content"
 */
export function generateAnnotationCallout(a: YtAnnotation): string {
  const cfg      = YT_LABELS[a.label] ?? YT_LABELS.note;
  const videoUrl = `https://www.youtube.com/watch?v=${a.video_id}&t=${a.seconds}s`;
  const title    = a.video_title || `YouTube — ${a.video_id}`;
  const lines    = [
    `> [!kirio-red-annotation] [${title} ↗](${videoUrl})`,
    `> ⏱ ${formatSeconds(a.seconds)} · ${cfg.icon} ${cfg.label}`,
  ];
  if (a.content) lines.push(`> "${a.content.replace(/>/g, '\\>')}"`);
  return lines.join('\n');
}
