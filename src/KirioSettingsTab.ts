import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type KirioPlugin from './main';
import { getSupabase } from './supabaseClient';

export class KirioSettingsTab extends PluginSettingTab {
  plugin: KirioPlugin;

  constructor(app: App, plugin: KirioPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    // Page heading — using the official Obsidian API
    new Setting(containerEl).setName('Kirio').setHeading();

    // ── Account status ───────────────────────────────────────────────────
    const { data: { session } } = await getSupabase().auth.getSession();

    if (session?.user) {
      new Setting(containerEl)
        .setName('Account')
        .setDesc(`Signed in as ${session.user.email}`)
        .addButton(btn => btn
          .setButtonText('Logout')
          .setWarning()
          .onClick(async () => {
            await getSupabase().auth.signOut();
            new Notice('Logged out of Kirio.');
            this.display();
          }));
    } else {
      new Setting(containerEl)
        .setName('Account')
        .setDesc('Not signed in. Open the Kirio panel and click "Log In".')
        .addButton(btn => btn
          .setButtonText('Open Panel')
          .onClick(() => (this.plugin as any).activateView()));
    }

    // ── Connection info (read-only) ──────────────────────────────────────
    new Setting(containerEl).setName('Connection').setHeading();

    containerEl.createEl('p', {
      text: 'These credentials are pre-configured and connect Kirio to your Supabase project.',
      cls: 'kirio-settings-desc',
    });

    // Supabase URL — static display
    const urlSetting = new Setting(containerEl)
      .setName('Supabase URL')
      .setDesc(this.plugin.settings.supabaseUrl);
    urlSetting.settingEl.addClass('kirio-readonly-setting');

    // Anon Key — masked static display
    const maskedKey = this.plugin.settings.supabaseAnonKey.substring(0, 20) + '••••••••••••••••••••';
    const keySetting = new Setting(containerEl)
      .setName('Anon Key')
      .setDesc(maskedKey);
    keySetting.settingEl.addClass('kirio-readonly-setting');

    containerEl.createEl('p', {
      text: '🔒 The anon key is a public client key secured by Row Level Security policies in Supabase. It is safe to embed in the plugin.',
      cls: 'kirio-settings-hint',
    });

    // ── About ────────────────────────────────────────────────────────────
    new Setting(containerEl).setName('About').setHeading();

    new Setting(containerEl)
      .setName('Version')
      .setDesc('1.0.0');
  }
}
