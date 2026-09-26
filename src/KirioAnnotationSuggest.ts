/**
 * KirioAnnotationSuggest.ts
 * EditorSuggest triggered by \a  — inline search for YouTube annotations.
 * Type "\a " in any note, then start typing a video title or keyword.
 * Arrow keys navigate, Enter inserts the kirio-red-annotation callout.
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
import { YtAnnotation } from './types';
import { generateAnnotationCallout, formatSeconds, YT_LABELS } from './callouts';

const TRIGGER = '\\a '; // literal backslash-a-space

export class KirioAnnotationSuggest extends EditorSuggest<YtAnnotation> {
  private cache: YtAnnotation[] = [];
  private cacheAt  = 0;
  private readonly TTL = 60_000; // 1 minute

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
  private async loadCache(): Promise<YtAnnotation[]> {
    if (this.cache.length && Date.now() - this.cacheAt < this.TTL) return this.cache;
    try {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return [];
      const { data } = await getSupabase()
        .from('yt_annotations')
        .select('*')
        .eq('user_uuid', user.id)
        .order('created_at', { ascending: false });
      this.cache  = (data as YtAnnotation[]) ?? [];
      this.cacheAt = Date.now();
    } catch { /* not logged in */ }
    return this.cache;
  }

  /** Expose so the modal can share the same warm cache. */
  async getAll(): Promise<YtAnnotation[]> {
    return this.loadCache();
  }

  async getSuggestions(ctx: EditorSuggestContext): Promise<YtAnnotation[]> {
    const all = await this.loadCache();
    const q   = ctx.query.toLowerCase().trim();
    if (!q) return all.slice(0, 15);
    return all
      .filter(a =>
        a.video_title?.toLowerCase().includes(q) ||
        a.content?.toLowerCase().includes(q)     ||
        a.label?.toLowerCase().includes(q)        ||
        a.channel?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  renderSuggestion(a: YtAnnotation, el: HTMLElement): void {
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
      const preview = a.content.length > 80 ? a.content.substring(0, 80) + '…' : a.content;
      el.createEl('p', { text: `"${preview}"`, cls: 'kirio-si-preview' });
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────
  selectSuggestion(a: YtAnnotation, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    editor.replaceRange(generateAnnotationCallout(a), start, end);
  }
}
