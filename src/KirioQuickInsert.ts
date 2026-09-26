/**
 * KirioQuickInsert.ts
 * Full-screen fuzzy-search modals for Alt+A (annotations) and Alt+H (highlights).
 * Opens Obsidian's command-palette-style picker over the entire workspace.
 * Arrow keys + Enter insert the selected callout at the active cursor.
 */

import { App, Editor, FuzzyMatch, FuzzySuggestModal } from 'obsidian';
import { getSupabase } from './supabaseClient';
import { Highlight, YtAnnotation } from './types';
import {
  generateAnnotationCallout,
  generateHighlightCallout,
  formatSeconds,
  YT_LABELS,
} from './callouts';

// ═══════════════════════════════════════════════════════════
// ── YouTube Annotations Modal  (Alt+A) ──────────────────
// ═══════════════════════════════════════════════════════════

export class KirioAnnotationModal extends FuzzySuggestModal<YtAnnotation> {
  private editor: Editor;
  private items: YtAnnotation[] = [];

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.setPlaceholder('Search YouTube annotations by title, note, or label…');
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵',  purpose: 'insert callout' },
      { command: 'esc', purpose: 'close' },
    ]);
  }

  /** Call before open() so items are ready. */
  async loadItems(): Promise<void> {
    try {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return;
      const { data } = await getSupabase()
        .from('yt_annotations')
        .select('*')
        .eq('user_uuid', user.id)
        .order('created_at', { ascending: false });
      this.items = (data as YtAnnotation[]) ?? [];
    } catch { /* ignore */ }
  }

  getItems(): YtAnnotation[] { return this.items; }

  /** Text the fuzzy engine matches against. */
  getItemText(a: YtAnnotation): string {
    return [a.video_title, a.content, a.label, a.channel].filter(Boolean).join(' ');
  }

  renderSuggestion(match: FuzzyMatch<YtAnnotation>, el: HTMLElement): void {
    const a   = match.item;
    const cfg = YT_LABELS[a.label] ?? YT_LABELS.note;
    el.addClass('kirio-suggest-item');

    const top = el.createDiv('kirio-si-top');
    top.createEl('span', { text: '▶', cls: 'kirio-si-play' });
    top.createEl('span', { text: a.video_title || a.video_id, cls: 'kirio-si-title' });

    const meta = el.createDiv('kirio-si-meta');
    meta.createEl('span', { text: `⏱ ${formatSeconds(a.seconds)}`, cls: 'kirio-si-ts' });
    meta.createEl('span', { text: `${cfg.icon} ${cfg.label}`, cls: 'kirio-si-label' });
    if (a.channel) meta.createEl('span', { text: a.channel, cls: 'kirio-si-channel' });

    if (a.content) {
      const preview = a.content.length > 100 ? a.content.substring(0, 100) + '…' : a.content;
      el.createEl('p', { text: `"${preview}"`, cls: 'kirio-si-preview' });
    }
  }

  onChooseItem(a: YtAnnotation, _evt: MouseEvent | KeyboardEvent): void {
    this.editor.replaceSelection(generateAnnotationCallout(a));
  }
}

// ═══════════════════════════════════════════════════════════
// ── Web Highlights Modal  (Alt+H) ────────────────────────
// ═══════════════════════════════════════════════════════════

export class KirioHighlightModal extends FuzzySuggestModal<Highlight> {
  private editor: Editor;
  private items: Highlight[] = [];

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.setPlaceholder('Search web highlights by page, keyword, or URL…');
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵',  purpose: 'insert callout' },
      { command: 'esc', purpose: 'close' },
    ]);
  }

  async loadItems(): Promise<void> {
    try {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return;
      const { data } = await getSupabase()
        .from('highlights')
        .select('*')
        .eq('user_uuid', user.id)
        .order('created_at', { ascending: false });
      this.items = (data as Highlight[]) ?? [];
    } catch { /* ignore */ }
  }

  getItems(): Highlight[] { return this.items; }

  getItemText(h: Highlight): string {
    return [h.title, h.text, h.url].filter(Boolean).join(' ');
  }

  renderSuggestion(match: FuzzyMatch<Highlight>, el: HTMLElement): void {
    const h           = match.item;
    const accentColor = h.color_tag?.startsWith('#') ? h.color_tag : '#fef08a';
    el.addClass('kirio-suggest-item');

    const top    = el.createDiv('kirio-si-top');
    const swatch = top.createEl('span', { cls: 'kirio-si-swatch' });
    swatch.setCssProps({ '--kirio-swatch': accentColor });

    const titleText = h.title
      || (() => { try { return new URL(h.url).hostname; } catch { return h.url; } })();
    top.createEl('span', { text: titleText, cls: 'kirio-si-title' });

    let hostname = h.url;
    try { hostname = new URL(h.url).hostname; } catch { /* ignore */ }
    el.createEl('p', { text: hostname, cls: 'kirio-si-url' });

    const preview = h.text.length > 100 ? h.text.substring(0, 100) + '…' : h.text;
    el.createEl('p', { text: `"${preview}"`, cls: 'kirio-si-preview' });
  }

  onChooseItem(h: Highlight, _evt: MouseEvent | KeyboardEvent): void {
    this.editor.replaceSelection(generateHighlightCallout(h));
  }
}
