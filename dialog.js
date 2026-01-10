(() => {
  const state = {
    overlay: null,
    resolve: null,
    mode: null,
    lastFocus: null,
  };

  const ICONS = {
    info: '⟲',
    danger: '⚠',
    success: '✓',
  };

  function ensureDom() {
    if (state.overlay) return;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="dialog-card" role="dialog" aria-modal="true">
        <div class="dialog-header">
          <div class="dialog-icon" data-dialog-icon>⟲</div>
          <div class="dialog-titles">
            <div class="dialog-title" data-dialog-title>Confirm</div>
            <div class="dialog-sub" data-dialog-sub></div>
          </div>
        </div>
        <div class="dialog-body" data-dialog-body></div>
        <div class="dialog-input-wrap hidden" data-dialog-input-wrap>
          <input class="dialog-input" data-dialog-input type="text" />
        </div>
        <div class="dialog-actions">
          <button type="button" class="dialog-btn ghost" data-dialog-cancel>Cancel</button>
          <button type="button" class="dialog-btn primary" data-dialog-confirm>Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    state.overlay = overlay;
    state.card = overlay.querySelector('.dialog-card');
    state.title = overlay.querySelector('[data-dialog-title]');
    state.sub = overlay.querySelector('[data-dialog-sub]');
    state.body = overlay.querySelector('[data-dialog-body]');
    state.icon = overlay.querySelector('[data-dialog-icon]');
    state.inputWrap = overlay.querySelector('[data-dialog-input-wrap]');
    state.input = overlay.querySelector('[data-dialog-input]');
    state.cancelBtn = overlay.querySelector('[data-dialog-cancel]');
    state.confirmBtn = overlay.querySelector('[data-dialog-confirm]');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && state.mode !== 'alert') finish(null);
    });
    state.cancelBtn.addEventListener('click', () => finish(null));
    state.confirmBtn.addEventListener('click', () => {
      if (state.mode === 'prompt') {
        finish(state.input.value ?? '');
      } else {
        finish(true);
      }
    });

    overlay.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('visible')) return;
      if (e.key === 'Escape' && state.mode !== 'alert') {
        e.preventDefault();
        finish(null);
      }
      if (e.key === 'Enter' && state.mode !== 'prompt') {
        e.preventDefault();
        state.confirmBtn.click();
      }
      if (e.key === 'Tab') {
        const focusables = getFocusables();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  function getFocusables() {
    const items = [
      state.input,
      state.cancelBtn,
      state.confirmBtn,
    ].filter(Boolean);
    return items.filter((el) => el && !el.classList.contains('hidden') && !el.disabled);
  }

  function finish(result) {
    if (!state.overlay) return;
    state.overlay.classList.remove('visible');
    state.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('dialog-open');
    setTimeout(() => {
      state.overlay.style.display = 'none';
      state.card.classList.remove('danger', 'success');
    }, 160);
    if (state.resolve) state.resolve(state.mode === 'alert' ? undefined : result);
    state.resolve = null;
    state.mode = null;
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
      state.lastFocus.focus();
      state.lastFocus = null;
    }
  }

  function openDialog(options) {
    ensureDom();
    const {
      mode = 'alert',
      title = 'Heads up',
      sub = '',
      message = '',
      confirmText = 'OK',
      cancelText = 'Cancel',
      tone = 'info',
      placeholder = '',
      defaultValue = '',
    } = options || {};

    state.mode = mode;
    state.title.textContent = title;
    state.sub.textContent = sub || '';
    state.sub.classList.toggle('hidden', !sub);
    state.body.textContent = message || '';
    state.icon.textContent = ICONS[tone] || ICONS.info;
    state.card.classList.remove('danger', 'success');
    if (tone === 'danger') state.card.classList.add('danger');
    if (tone === 'success') state.card.classList.add('success');

    state.confirmBtn.textContent = confirmText || 'OK';
    state.cancelBtn.textContent = cancelText || 'Cancel';
    state.cancelBtn.classList.toggle('hidden', mode === 'alert');

    if (mode === 'prompt') {
      state.inputWrap.classList.remove('hidden');
      state.input.value = defaultValue || '';
      state.input.placeholder = placeholder || '';
    } else {
      state.inputWrap.classList.add('hidden');
      state.input.value = '';
    }

    state.overlay.style.display = 'flex';
    void state.overlay.offsetWidth; // force reflow
    state.overlay.classList.add('visible');
    state.overlay.removeAttribute('aria-hidden');
    document.body.classList.add('dialog-open');

    state.lastFocus = document.activeElement;
    setTimeout(() => {
      if (mode === 'prompt' && state.input) {
        state.input.focus();
        state.input.select();
      } else {
        state.confirmBtn?.focus();
      }
    }, 20);

    return new Promise((resolve) => {
      state.resolve = resolve;
    });
  }

  async function uiAlert(message, options) {
    await openDialog({
      mode: 'alert',
      message,
      ...(options || {}),
    });
  }

  async function uiConfirm(message, options) {
    const result = await openDialog({
      mode: 'confirm',
      message,
      title: 'Please confirm',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      ...(options || {}),
    });
    return !!result;
  }

  async function uiPrompt(message, options) {
    const result = await openDialog({
      mode: 'prompt',
      message,
      title: 'Input',
      confirmText: 'Save',
      cancelText: 'Cancel',
      ...(options || {}),
    });
    if (result === null) return null;
    return result;
  }

  window.uiAlert = uiAlert;
  window.uiConfirm = uiConfirm;
  window.uiPrompt = uiPrompt;
})();
