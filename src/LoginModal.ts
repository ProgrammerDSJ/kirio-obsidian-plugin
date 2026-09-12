import { App, Modal, Notice } from 'obsidian';
import { getSupabase } from './supabaseClient';

/**
 * LoginModal — login only.
 * Signup is intentionally not here; create your account via the browser extension.
 */
export class LoginModal extends Modal {
  private onSuccess: () => void;

  constructor(app: App, onSuccess: () => void) {
    super(app);
    this.onSuccess = onSuccess;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('kirio-modal');

    contentEl.createEl('h2', { text: 'Kirio' });
    contentEl.createEl('p', {
      text: 'Sign in to view your synced highlights.',
      cls: 'kirio-modal-subtitle',
    });

    const emailInput    = contentEl.createEl('input', { type: 'email',    placeholder: 'Email',    cls: 'kirio-input' });
    const passwordInput = contentEl.createEl('input', { type: 'password', placeholder: 'Password', cls: 'kirio-input' });

    const errorEl = contentEl.createEl('p', { cls: 'kirio-error' });

    const loginBtn = contentEl.createEl('button', { text: 'Login', cls: 'kirio-btn-primary' });

    const doLogin = async () => {
      if (!emailInput.value || !passwordInput.value) {
        errorEl.textContent = 'Please fill in both fields.';
        return;
      }
      errorEl.textContent = 'Logging in…';
      const { error } = await getSupabase().auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value,
      });
      if (error) {
        errorEl.textContent = error.message;
      } else {
        new Notice('✅ Logged in to Kirio!');
        this.close();
        this.onSuccess();
      }
    };

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

    contentEl.createEl('p', {
      text: '💡 To create an account, use the Kirio browser extension.',
      cls: 'kirio-modal-hint',
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
