# 🔖 Kirio Web Highlighter – Obsidian Plugin

The official companion Obsidian plugin for the **Kirio Web Highlighter**. Seamlessly sync your web highlights, notes, and annotations directly into your Obsidian vault. 

Kirio bridges the gap between your web research and your personal knowledge management system by bringing all your colored highlights into a dedicated, searchable sidebar right inside Obsidian.

---

## ✨ Features

- 🔄 **Cloud Syncing:** Connects directly to your Kirio account via Supabase to pull in your highlights instantly.
- 🎨 **Native Colored Callouts:** Copy any highlight with a single click. It pastes into your notes as a beautifully formatted Obsidian callout that retains your original highlight color (Yellow, Pink, Green, Blue, or Red) using a custom highlighter icon.
- 🔗 **Deep Linking:** Click **Source ↗** on any highlight card to open the web page and jump straight to the exact text you highlighted.
- 🔍 **Global Search:** Quickly filter and find specific highlights across all your saved web pages directly from the sidebar.
- 🔒 **Secure & Read-Only:** The plugin acts as a secure read-only window into your highlights. Modifications and account creations are handled safely in the browser extension.

---

## 🚀 Installation

Currently, this plugin is installed manually. Follow these steps to add it to your vault:

1. Open your file explorer and navigate to your Obsidian vault.
2. Go to the plugins directory: `<Your Vault>/.obsidian/plugins/`. *(If the `plugins` folder doesn't exist, create it).*
3. Create a new folder inside `plugins` named **exactly**: `kirio-highlights`
4. Copy the following three compiled files from this repository into the `kirio-highlights` folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
5. Open Obsidian, go to **Settings → Community Plugins**.
6. Disable "Restricted mode" if it is on.
7. Click the **Reload plugins** button (circular arrow).
8. Find **Kirio** in the list and toggle it **ON**.

---

## 📖 How to Use

1. **Open the Panel:** Click the **Bookmark** icon (🔖) in the left ribbon bar to open the Kirio highlights panel in your right sidebar.
2. **Log In:** Click **Log In** and use the exact same email and password you used to sign up in the Kirio Chrome extension.
3. **Browse:** Your highlights will load automatically, grouped by the web pages they were taken from.
4. **Copy to Notes:** Click the **📋 Copy** button on any highlight. Paste it into your Obsidian note. It will automatically format as a colored callout:
   ```markdown
   > [!kirio-pink] [Page Title ↗](https://example.com#kirio-123)
   > "This is your highlighted text perfectly preserved."
   ```

---

## 🛠️ Development

If you want to modify and build the plugin yourself:

1. Open a terminal in the `obsidian-plugin` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. *Optional:* For active development, you can use watch mode to automatically recompile on save:
   ```bash
   npm run dev
   ```

*(Tip: You can use a script or symlink to automatically copy the built files into your vault's `.obsidian/plugins/kirio-highlights` directory during development).*
