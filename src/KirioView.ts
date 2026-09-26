import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { getSupabase } from './supabaseClient';
import { LoginModal } from './LoginModal';
import { Highlight, YtAnnotation } from './types';
import {
  generateHighlightCallout,
  generateAnnotationCallout,
  formatSeconds,
  YT_LABELS,
} from './callouts';

export const KIRIO_VIEW_TYPE = 'kirio-highlights-view';

// ── View ──────────────────────────────────────────────────────────────────
type Tab = 'highlights' | 'youtube';

export class KirioView extends ItemView {
  private highlights: Highlight[]    = [];
  private annotations: YtAnnotation[] = [];
  private activeTab: Tab = 'highlights';

  constructor(leaf: WorkspaceLeaf) { super(leaf); }

  getViewType():    string { return KIRIO_VIEW_TYPE; }
  getDisplayText(): string { return 'Kirio Highlights'; }
  getIcon():        string { return 'bookmark'; }

  async onOpen() { await this.render(); }

  // ── Top-level render ────────────────────────────────────────────────────
  async render() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('kirio-view');

    const { data: { session } } = await getSupabase().auth.getSession();

    if (!session) {
      this.renderGuest(root);
    } else {
      this.renderShell(root);
      await this.loadActiveTab(root);
    }
  }

  // ── Guest state ──────────────────────────────────────────────────────────
  private renderGuest(root: HTMLElement) {
    const wrap = root.createDiv('kirio-guest');
    wrap.createEl('div', { text: '🔖', cls: 'kirio-guest-icon' });
    wrap.createEl('h3', { text: 'Your highlights, here.' });
    wrap.createEl('p', {
      text: 'Log in to see all your Kirio web highlights directly inside Obsidian.',
      cls: 'kirio-guest-sub',
    });
    const btn = wrap.createEl('button', { text: 'Log In', cls: 'kirio-btn-primary' });
    btn.addEventListener('click', () => {
      new LoginModal(this.app, () => this.render()).open();
    });
  }

  // ── Logged-in shell (header + tabs) ─────────────────────────────────────
  private renderShell(root: HTMLElement) {
    // ── Top header row ──────────────────────────────────────────────────
    const header = root.createDiv('kirio-header');

    const brand = header.createDiv('kirio-brand-row');
    brand.createEl('span', { text: 'Kirio', cls: 'kirio-brand-name' });
    brand.createEl('span', { cls: 'kirio-brand-dot' });

    const actions = header.createDiv('kirio-header-actions');

    const refreshBtn = actions.createEl('button', { cls: 'kirio-icon-btn', title: 'Refresh', text: '↻' });
    refreshBtn.addEventListener('click', async () => {
      const content = root.querySelector('.kirio-content') as HTMLElement | null;
      if (content) { content.empty(); content.createEl('p', { text: 'Refreshing…', cls: 'kirio-loading' }); }
      await this.loadActiveTab(root);
    });

    const logoutBtn = actions.createEl('button', { text: 'Logout', cls: 'kirio-logout-btn' });
    logoutBtn.addEventListener('click', async () => {
      await getSupabase().auth.signOut();
      new Notice('Logged out of Kirio.');
      await this.render();
    });

    // ── Tab bar ─────────────────────────────────────────────────────────
    const tabBar = root.createDiv('kirio-tab-bar');

    const highlightsTab = tabBar.createEl('button', {
      text: '🔖 Highlights',
      cls: 'kirio-tab' + (this.activeTab === 'highlights' ? ' kirio-tab-active' : ''),
    });
    const ytTab = tabBar.createEl('button', {
      text: '▶ YouTube',
      cls: 'kirio-tab' + (this.activeTab === 'youtube' ? ' kirio-tab-active' : ''),
    });

    highlightsTab.addEventListener('click', async () => {
      if (this.activeTab === 'highlights') return;
      this.activeTab = 'highlights';
      highlightsTab.classList.add('kirio-tab-active');
      ytTab.classList.remove('kirio-tab-active');
      await this.loadActiveTab(root);
    });

    ytTab.addEventListener('click', async () => {
      if (this.activeTab === 'youtube') return;
      this.activeTab = 'youtube';
      ytTab.classList.add('kirio-tab-active');
      highlightsTab.classList.remove('kirio-tab-active');
      await this.loadActiveTab(root);
    });
  }

  // ── Route to the active tab's loader ────────────────────────────────────
  private async loadActiveTab(root: HTMLElement) {
    if (this.activeTab === 'highlights') {
      await this.loadHighlights(root);
    } else {
      await this.loadAnnotations(root);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── TAB 1: WEB HIGHLIGHTS ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  async loadHighlights(root: HTMLElement) {
    let content = root.querySelector('.kirio-content') as HTMLElement | null;
    if (content) content.empty();
    else content = root.createDiv('kirio-content');

    content.createEl('p', { text: 'Loading highlights…', cls: 'kirio-loading' });

    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) { await this.render(); return; }

    const { data, error } = await getSupabase()
      .from('highlights')
      .select('*')
      .eq('user_uuid', user.id)
      .order('created_at', { ascending: false });

    content.empty();

    if (error) { content.createEl('p', { text: `Error: ${error.message}`, cls: 'kirio-error' }); return; }
    if (!data || data.length === 0) { this.renderHighlightsEmpty(content); return; }

    this.highlights = data as Highlight[];
    this.renderHighlightsList(content);
  }

  private renderHighlightsEmpty(container: HTMLElement) {
    const wrap = container.createDiv('kirio-empty');
    wrap.createEl('div', { text: '✏️', cls: 'kirio-empty-icon' });
    wrap.createEl('p', { text: 'No highlights yet.' });
    wrap.createEl('p', { text: 'Highlight text on any webpage using the Kirio browser extension.', cls: 'kirio-empty-sub' });
  }

  private renderHighlightsList(container: HTMLElement) {
    const grouped = new Map<string, Highlight[]>();
    for (const h of this.highlights) {
      if (!grouped.has(h.url)) grouped.set(h.url, []);
      grouped.get(h.url)!.push(h);
    }

    // Search bar
    const searchWrap  = container.createDiv('kirio-search-wrap');
    const searchInput = searchWrap.createEl('input', {
      type: 'text', placeholder: '🔍  Search highlights…', cls: 'kirio-search',
    });

    // Stats
    const stats = container.createDiv('kirio-stats');
    stats.createEl('span', {
      text: `${this.highlights.length} highlight${this.highlights.length !== 1 ? 's' : ''} · ${grouped.size} page${grouped.size !== 1 ? 's' : ''}`,
      cls: 'kirio-stats-text',
    });

    const listEl = container.createDiv('kirio-list');

    const render = (query: string) => {
      listEl.empty();
      let shown = 0;

      grouped.forEach((highlights, url) => {
        const filtered = query
          ? highlights.filter(h => h.text.toLowerCase().includes(query.toLowerCase()))
          : highlights;
        if (filtered.length === 0) return;
        shown += filtered.length;

        const pageTitle = highlights[0]?.title || (() => { try { return new URL(url).hostname; } catch { return url; } })();
        const section   = listEl.createDiv('kirio-section');

        const pageHeader = section.createDiv('kirio-page-header');
        pageHeader.createEl('span', { text: pageTitle, cls: 'kirio-page-title', title: url });
        const openBtn = pageHeader.createEl('a', { text: '↗', cls: 'kirio-open-link', title: 'Open in browser' });
        openBtn.href = url;

        filtered.forEach(h => this.renderHighlightCard(section, h));
      });

      if (shown === 0 && query) {
        listEl.createEl('p', { text: 'No highlights match your search.', cls: 'kirio-loading' });
      }
    };

    render('');
    searchInput.addEventListener('input', () => render(searchInput.value.trim()));
  }

  private renderHighlightCard(container: HTMLElement, h: Highlight) {
    const card = container.createDiv('kirio-card');

    const bar = card.createDiv('kirio-color-bar');
    const accentColor = h.color_tag?.startsWith('#') ? h.color_tag : '#fef08a';
    bar.setCssProps({ '--kirio-bar-color': accentColor });

    const body = card.createDiv('kirio-card-body');

    const displayText = h.text.length > 220 ? h.text.substring(0, 220) + '…' : h.text;
    body.createEl('p', { text: displayText, cls: 'kirio-card-text' });

    const footer      = body.createDiv('kirio-card-footer');
    const date        = new Date(h.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    footer.createEl('span', { text: date, cls: 'kirio-card-date' });

    const footerActions = footer.createDiv('kirio-card-actions');

    const goBtn = footerActions.createEl('a', { text: 'Source ↗', cls: 'kirio-go-btn', title: `Jump to: ${h.url}` });
    goBtn.href = `${h.url}#kirio-${h.id}`;

    const copyBtn = footerActions.createEl('button', { text: '📋 Copy', cls: 'kirio-copy-btn', title: 'Copy as Obsidian callout' });
    copyBtn.addEventListener('click', () => {
      const markdown = generateHighlightCallout(h);
      navigator.clipboard.writeText(markdown).then(() => {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
      }).catch(() => new Notice('Could not copy to clipboard.'));
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── TAB 2: YOUTUBE ANNOTATIONS ───────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  async loadAnnotations(root: HTMLElement) {
    let content = root.querySelector('.kirio-content') as HTMLElement | null;
    if (content) content.empty();
    else content = root.createDiv('kirio-content');

    content.createEl('p', { text: 'Loading annotations…', cls: 'kirio-loading' });

    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) { await this.render(); return; }

    const { data, error } = await getSupabase()
      .from('yt_annotations')
      .select('*')
      .eq('user_uuid', user.id)
      .order('created_at', { ascending: false });

    content.empty();

    if (error) { content.createEl('p', { text: `Error: ${error.message}`, cls: 'kirio-error' }); return; }
    if (!data || data.length === 0) { this.renderAnnotationsEmpty(content); return; }

    this.annotations = data as YtAnnotation[];
    this.renderAnnotationsList(content);
  }

  private renderAnnotationsEmpty(container: HTMLElement) {
    const wrap = container.createDiv('kirio-empty');
    wrap.createEl('div', { text: '▶', cls: 'kirio-empty-icon' });
    wrap.createEl('p', { text: 'No YouTube annotations yet.' });
    wrap.createEl('p', {
      text: 'Click the 📌 button in the YouTube player or press Ctrl+A while watching a video.',
      cls: 'kirio-empty-sub',
    });
  }

  private renderAnnotationsList(container: HTMLElement) {
    // Group by video_id
    const grouped = new Map<string, YtAnnotation[]>();
    for (const a of this.annotations) {
      if (!grouped.has(a.video_id)) grouped.set(a.video_id, []);
      grouped.get(a.video_id)!.push(a);
    }

    // Search bar
    const searchWrap  = container.createDiv('kirio-search-wrap');
    const searchInput = searchWrap.createEl('input', {
      type: 'text', placeholder: '🔍  Search annotations…', cls: 'kirio-search',
    });

    // Stats
    const stats = container.createDiv('kirio-stats');
    stats.createEl('span', {
      text: `${this.annotations.length} annotation${this.annotations.length !== 1 ? 's' : ''} · ${grouped.size} video${grouped.size !== 1 ? 's' : ''}`,
      cls: 'kirio-stats-text',
    });

    const listEl = container.createDiv('kirio-list');

    const render = (query: string) => {
      listEl.empty();
      let shown = 0;

      grouped.forEach((annotations, videoId) => {
        const filtered = query
          ? annotations.filter(a =>
              a.content.toLowerCase().includes(query.toLowerCase()) ||
              a.video_title.toLowerCase().includes(query.toLowerCase()) ||
              a.label.toLowerCase().includes(query.toLowerCase())
            )
          : annotations;
        if (filtered.length === 0) return;
        shown += filtered.length;

        const videoTitle  = annotations[0]?.video_title || `Video ${videoId}`;
        const channel     = annotations[0]?.channel || '';
        const videoUrl    = `https://www.youtube.com/watch?v=${videoId}`;
        const section     = listEl.createDiv('kirio-section');

        // Video header
        const pageHeader = section.createDiv('kirio-page-header');
        const titleWrap  = pageHeader.createDiv('kirio-yt-title-wrap');
        titleWrap.createEl('span', { text: '▶ ', cls: 'kirio-yt-icon' });
        const titleEl = titleWrap.createEl('span', { text: videoTitle, cls: 'kirio-page-title', title: videoUrl });
        if (channel) titleEl.title = `${videoTitle}\n${channel}`;

        const headerRight = pageHeader.createDiv('kirio-page-header-right');
        if (channel) {
          headerRight.createEl('span', { text: channel, cls: 'kirio-yt-channel' });
        }
        const openBtn = headerRight.createEl('a', { text: '↗', cls: 'kirio-open-link', title: 'Open video' });
        openBtn.href  = videoUrl;

        // Sort by timestamp ascending within each video section
        const sorted = [...filtered].sort((a, b) => a.seconds - b.seconds);
        sorted.forEach(a => this.renderAnnotationCard(section, a));
      });

      if (shown === 0 && query) {
        listEl.createEl('p', { text: 'No annotations match your search.', cls: 'kirio-loading' });
      }
    };

    render('');
    searchInput.addEventListener('input', () => render(searchInput.value.trim()));
  }

  private renderAnnotationCard(container: HTMLElement, a: YtAnnotation) {
    const cfg       = YT_LABELS[a.label] ?? YT_LABELS.note;
    const videoUrl  = `https://www.youtube.com/watch?v=${a.video_id}&t=${a.seconds}s`;

    const card = container.createDiv('kirio-card');

    // Red accent bar for all YouTube annotations — color set via CSS class
    card.createDiv('kirio-color-bar kirio-color-bar--yt');

    const body = card.createDiv('kirio-card-body');

    // Top row: timestamp chip + label pill
    const topRow = body.createDiv('kirio-ann-top-row');

    const tsChip = topRow.createEl('span', {
      text: `⏱ ${formatSeconds(a.seconds)}`,
      cls: 'kirio-ts-chip',
      title: 'Jump to this moment',
    });
    // Clicking the timestamp chip opens the video at that exact second
    tsChip.addEventListener('click', () => { window.open(videoUrl, '_blank'); });

    topRow.createEl('span', {
      text: `${cfg.icon} ${cfg.label}`,
      cls: 'kirio-label-pill',
    });

    // Note content
    if (a.content) {
      const displayText = a.content.length > 220 ? a.content.substring(0, 220) + '…' : a.content;
      body.createEl('p', { text: displayText, cls: 'kirio-card-text kirio-ann-content' });
    } else {
      body.createEl('p', { text: '(no note)', cls: 'kirio-card-text kirio-ann-no-content' });
    }

    // Footer
    const footer  = body.createDiv('kirio-card-footer');
    const date    = new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    footer.createEl('span', { text: date, cls: 'kirio-card-date' });

    const footerActions = footer.createDiv('kirio-card-actions');

    const goBtn = footerActions.createEl('a', {
      text: 'Source ↗',
      cls: 'kirio-go-btn',
      title: `Open video at ${formatSeconds(a.seconds)}`,
    });
    goBtn.href = videoUrl;

    const copyBtn = footerActions.createEl('button', {
      text: '📋 Copy',
      cls: 'kirio-copy-btn',
      title: 'Copy as Obsidian callout',
    });
    copyBtn.addEventListener('click', () => {
      const markdown = generateAnnotationCallout(a);
      navigator.clipboard.writeText(markdown).then(() => {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
      }).catch(() => new Notice('Could not copy to clipboard.'));
    });
  }

  async onClose() { /* no cleanup needed */ }
}
