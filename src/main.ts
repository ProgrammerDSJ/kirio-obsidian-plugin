import { Editor, Plugin } from 'obsidian';
import { KirioView, KIRIO_VIEW_TYPE } from './KirioView';
import { KirioSettingsTab } from './KirioSettingsTab';
import { initSupabase } from './supabaseClient';
import { KirioSettings, DEFAULT_SETTINGS } from './types';
import { KirioAnnotationSuggest } from './KirioAnnotationSuggest';
import { KirioHighlightSuggest } from './KirioHighlightSuggest';
import { KirioAnnotationModal, KirioHighlightModal } from './KirioQuickInsert';

export default class KirioPlugin extends Plugin {
  settings: KirioSettings;

  async onload() {
    // 1. Load persisted settings (falls back to DEFAULT_SETTINGS)
    await this.loadSettings();

    // 2. Initialise Supabase — callout CSS is bundled in styles.css, no snippet needed
    initSupabase(this.settings.supabaseUrl, this.settings.supabaseAnonKey);

    // 3. Register the sidebar view
    this.registerView(KIRIO_VIEW_TYPE, (leaf) => new KirioView(leaf));

    // 4. Ribbon bookmark icon — click to open/focus the panel
    this.addRibbonIcon('bookmark', 'Kirio Highlights', () => this.activateView());

    // 5. Settings tab
    this.addSettingTab(new KirioSettingsTab(this.app, this));

    // 6. Restore the panel if it was open before Obsidian reload
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(KIRIO_VIEW_TYPE).length === 0) {
        this.activateView();
      }
    });

    // ── 7. Inline EditorSuggesters (\a and \h triggers) ─────────────────
    this.registerEditorSuggest(new KirioAnnotationSuggest(this.app));
    this.registerEditorSuggest(new KirioHighlightSuggest(this.app));

    // ── 8. Quick-insert commands (Alt+A and Alt+H) ───────────────────────

    this.addCommand({
      id: 'kirio-insert-annotation',
      name: 'Insert YouTube annotation (Alt+A)',
      hotkeys: [{ modifiers: ['Alt'], key: 'a' }],
      editorCallback: async (editor: Editor) => {
        const modal = new KirioAnnotationModal(this.app, editor);
        await modal.loadItems();
        modal.open();
      },
    });

    this.addCommand({
      id: 'kirio-insert-highlight',
      name: 'Insert web highlight (Alt+H)',
      hotkeys: [{ modifiers: ['Alt'], key: 'h' }],
      editorCallback: async (editor: Editor) => {
        const modal = new KirioHighlightModal(this.app, editor);
        await modal.loadItems();
        modal.open();
      },
    });
  }

  /** Opens the Kirio panel in the right sidebar, creating it if needed. */
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(KIRIO_VIEW_TYPE);

    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = workspace.getRightLeaf(true);
    if (!leaf) return;
    await leaf.setViewState({ type: KIRIO_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {}
}
