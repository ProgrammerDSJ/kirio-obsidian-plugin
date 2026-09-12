import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { getSupabase } from './supabaseClient';
import { LoginModal } from './LoginModal';
import { Highlight } from './types';

export const KIRIO_VIEW_TYPE = 'kirio-highlights-view';

// ── Color → Obsidian callout type mapping ─────────────────────────────────
// Each type is defined in styles.css with:
//   - lucide-highlighter icon (same for all)
//   - the matching color from the browser extension
const HEX_TO_CALLOUT: Record<string, string> = {
  '#fef08a': 'kirio-yellow',
  '#f9a8d4': 'kirio-pink',
  '#86efac': 'kirio-green',
  '#93c5fd': 'kirio-blue',
  '#fca5a5': 'kirio-red',
};

function getCalloutType(hexColor: string): string {
  return HEX_TO_CALLOUT[hexColor?.toLowerCase()] ?? 'kirio-yellow';
}

/**
 * Generates a copy-paste-ready Obsidian callout for a highlight.
 * Example:
 *   > [!kirio-pink] [Page Title ↗](url#kirio-id)
 *   > "Highlighted text"
 */
function generateCallout(h: Highlight): string {
  const calloutType = h.color_tag?.startsWith('#')
    ? getCalloutType(h.color_tag)
    : 'kirio-yellow';

  const title      = h.title || (() => { try { return new URL(h.url).hostname; } catch { return h.url; } })();
  const deepLink   = `${h.url}#kirio-${h.id}`;
  const escapedText = h.text.replace(/>/g, '\\>');

  return `> [!${calloutType}] [${title} ↗](${deepLink})\n> "${escapedText}"`;
}

// ── View ──────────────────────────────────────────────────────────────────
export class KirioView extends ItemView {
  private highlights: Highlight[] = [];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string  { return KIRIO_VIEW_TYPE; }
  getDisplayText(): string { return 'Kirio Highlights'; }
  getIcon(): string { return 'bookmark'; }

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
      await this.loadHighlights(root);
    }
  }

  // ── Guest state ─────────────────────────────────────────────────────────
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

  // ── Logged-in shell ─────────────────────────────────────────────────────
  private renderShell(root: HTMLElement) {
    const header = root.createDiv('kirio-header');

    const brand = header.createDiv('kirio-brand-row');
    brand.createEl('span', { text: 'Kirio', cls: 'kirio-brand-name' });
    brand.createEl('span', { cls: 'kirio-brand-dot' });

    const actions = header.createDiv('kirio-header-actions');

    const refreshBtn = actions.createEl('button', { cls: 'kirio-icon-btn', title: 'Refresh highlights', text: '↻' });
    refreshBtn.addEventListener('click', async () => {
      const content = root.querySelector('.kirio-content') as HTMLElement | null;
      if (content) { content.empty(); content.createEl('p', { text: 'Refreshing…', cls: 'kirio-loading' }); }
      await this.loadHighlights(root);
    });

    const logoutBtn = actions.createEl('button', { text: 'Logout', cls: 'kirio-logout-btn' });
    logoutBtn.addEventListener('click', async () => {
      await getSupabase().auth.signOut();
      new Notice('Logged out of Kirio.');
      await this.render();
    });
  }

  // ── Data loading ────────────────────────────────────────────────────────
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
    if (!data || data.length === 0) { this.renderEmpty(content); return; }

    this.highlights = data as Highlight[];
    this.renderHighlights(content);
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  private renderEmpty(container: HTMLElement) {
    const wrap = container.createDiv('kirio-empty');
    wrap.createEl('div', { text: '✏️', cls: 'kirio-empty-icon' });
    wrap.createEl('p', { text: 'No highlights yet.' });
    wrap.createEl('p', { text: 'Highlight text on any webpage using the Kirio browser extension.', cls: 'kirio-empty-sub' });
  }

  // ── Highlights list ──────────────────────────────────────────────────────
  private renderHighlights(container: HTMLElement) {
    const grouped = new Map<string, Highlight[]>();
    for (const h of this.highlights) {
      if (!grouped.has(h.url)) grouped.set(h.url, []);
      grouped.get(h.url)!.push(h);
    }

    // Search bar
    const searchWrap = container.createDiv('kirio-search-wrap');
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

        // Page header
        const pageHeader = section.createDiv('kirio-page-header');
        pageHeader.createEl('span', { text: pageTitle, cls: 'kirio-page-title', title: url });
        const openBtn = pageHeader.createEl('a', { text: '↗', cls: 'kirio-open-link', title: 'Open in browser' });
        openBtn.href = url;

        // Cards
        filtered.forEach(h => this.renderCard(section, h));
      });

      if (shown === 0 && query) {
        listEl.createEl('p', { text: 'No highlights match your search.', cls: 'kirio-loading' });
      }
    };

    render('');
    searchInput.addEventListener('input', () => render(searchInput.value.trim()));
  }

  // ── Single highlight card ────────────────────────────────────────────────
  private renderCard(container: HTMLElement, h: Highlight) {
    const card = container.createDiv('kirio-card');

    // Left colour accent bar
    const bar = card.createDiv('kirio-color-bar');
    const accentColor = h.color_tag?.startsWith('#') ? h.color_tag : '#fef08a';
    bar.style.backgroundColor = accentColor;

    const body = card.createDiv('kirio-card-body');

    // Highlight text (truncated)
    const displayText = h.text.length > 220 ? h.text.substring(0, 220) + '…' : h.text;
    body.createEl('p', { text: displayText, cls: 'kirio-card-text' });

    // Footer row
    const footer = body.createDiv('kirio-card-footer');

    const date = new Date(h.created_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    footer.createEl('span', { text: date, cls: 'kirio-card-date' });

    const footerActions = footer.createDiv('kirio-card-actions');

    // "Go to source" deep link
    const goBtn = footerActions.createEl('a', {
      text: 'Source ↗',
      cls: 'kirio-go-btn',
      title: `Jump to: ${h.url}`,
    });
    goBtn.href = `${h.url}#kirio-${h.id}`;

    // "Copy to Obsidian" button
    const copyBtn = footerActions.createEl('button', {
      text: '📋 Copy',
      cls: 'kirio-copy-btn',
      title: 'Copy as Obsidian callout',
    });
    copyBtn.addEventListener('click', () => {
      const markdown = generateCallout(h);
      navigator.clipboard.writeText(markdown).then(() => {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
      }).catch(() => {
        new Notice('Could not copy to clipboard.');
      });
    });
  }

  async onClose() { /* no cleanup needed */ }
}
