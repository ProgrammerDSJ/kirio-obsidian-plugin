/**
 * KirioHighlightSuggest.ts
 * EditorSuggest triggered by \h  — inline search for web highlights.
 * Type "\h " in any note, then search by page title or highlighted text.
 * Arrow keys navigate, Enter inserts the correctly-colored callout.
 */

import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from 'obsidian';
import { getSupabase } from './supabaseClient';
import { Highlight } from './types';
import { generateHighlightCallout, HEX_TO_CALLOUT } from './callouts';

const TRIGGER = '\\h '; // literal backslash-h-space

// Accent colors for the swatch in suggestion items
const ACCENT_FALLBACK = '#fef08a';

export class KirioHighlightSuggest extends EditorSuggest<Highlight> {
  private cache: Highlight[] = [];
  private cacheAt  = 0;
  private readonly TTL = 60_000;

  constructor(app: App) {
    super(app);
  }

  // ── Trigger detection ────────────────────────────────────────────────────
  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null,
  ): EditorSuggestTriggerInfo | null {
    const line    = editor.getLine(cursor.line);
    const before  = line.substring(0, cursor.ch);
    const trigIdx = before.lastIndexOf(TRIGGER);
    if (trigIdx === -1) return null;
    return {
      start: { line: cursor.line, ch: trigIdx },
      end:   cursor,
      query: before.substring(trigIdx + TRIGGER.length),
    };
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  private async loadCache(): Promise<Highlight[]> {
    if (this.cache.length && Date.now() - this.cacheAt < this.TTL) return this.cache;
    try {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return [];
      const { data } = await getSupabase()
        .from('highlights')
        .select('*')
        .eq('user_uuid', user.id)
        .order('created_at', { ascending: false });
      this.cache  = (data as Highlight[]) ?? [];
      this.cacheAt = Date.now();
    } catch { /* not logged in */ }
    return this.cache;
  }

  async getAll(): Promise<Highlight[]> {
    return this.loadCache();
  }

  async getSuggestions(ctx: EditorSuggestContext): Promise<Highlight[]> {
    const all = await this.loadCache();
    const q   = ctx.query.toLowerCase().trim();
    if (!q) return all.slice(0, 15);
    return all
      .filter(h =>
        h.title?.toLowerCase().includes(q) ||
        h.text?.toLowerCase().includes(q)  ||
        h.url?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  renderSuggestion(h: Highlight, el: HTMLElement): void {
    el.addClass('kirio-suggest-item');

    const accentColor = h.color_tag?.startsWith('#') ? h.color_tag : ACCENT_FALLBACK;

    const top = el.createDiv('kirio-si-top');
    // Color swatch
    const swatch = top.createEl('span', { cls: 'kirio-si-swatch' });
    swatch.setCssProps({ '--kirio-swatch': accentColor });

    const titleText = h.title
      || (() => { try { return new URL(h.url).hostname; } catch { return h.url; } })();
    top.createEl('span', { text: titleText, cls: 'kirio-si-title' });

    // URL hostname as subtitle
    let hostname = h.url;
    try { hostname = new URL(h.url).hostname; } catch { /* ignore */ }
    el.createEl('p', { text: hostname, cls: 'kirio-si-url' });

    // Text preview
    const preview = h.text.length > 80 ? h.text.substring(0, 80) + '…' : h.text;
    el.createEl('p', { text: `"${preview}"`, cls: 'kirio-si-preview' });
  }

  // ── Selection ────────────────────────────────────────────────────────────
  selectSuggestion(h: Highlight, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    editor.replaceRange(generateHighlightCallout(h), start, end);
  }
}
