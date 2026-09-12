import { Plugin } from 'obsidian';
import { KirioView, KIRIO_VIEW_TYPE } from './KirioView';
import { KirioSettingsTab } from './KirioSettingsTab';
import { initSupabase } from './supabaseClient';
import { KirioSettings, DEFAULT_SETTINGS } from './types';

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
  }

  /** Opens the Kirio panel in the right sidebar, creating it if needed. */
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(KIRIO_VIEW_TYPE);

    if (existing.length > 0) {
      // Panel already exists — just bring it into focus
      workspace.setActiveLeaf(existing[0], { focus: true });
      return;
    }

    // Create the panel in the right sidebar
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: KIRIO_VIEW_TYPE, active: true });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {}
}
