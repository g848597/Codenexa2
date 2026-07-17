// Карточка входа/регистрации. Показывается один раз при старте, если у
// пользователя ещё нет активной сессии (см. main.js -> ensureAuthenticated).
// Внутри Telegram вход в один тап (initData уже подписана клиентом);
// снаружи — email/пароль или Google/Яндекс через внешний браузер.
import { authApi, setToken, isRunningInsideTelegram } from '../api/authApi.js';
import { haptic, openExternalLink } from '../telegram.js';

let mode = 'login'; // 'login' | 'register' | 'forgot' | 'reset'
let busy = false;
let errorMsg = '';
let successMsg = '';
let pendingTotp = false; // true, если сервер попросил код 2FA
let resetEmail = ''; // email, для которого запрошен код сброса пароля (флоу 'forgot' -> 'reset')

function icon(name) {
  const icons = {
    telegram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.05 3.16 2.9 10.28c-1.23.5-1.22 1.19-.22 1.5l4.65 1.45 1.8 5.55c.22.6.37.84.76.84.3 0 .43-.13.6-.32l2.05-1.98 4.28 3.16c.79.44 1.35.21 1.55-.73l2.8-13.2c.3-1.16-.44-1.69-1.14-1.4Z"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.07-1.47-.22-2.12H12v3.85h6.6c-.13 1.1-.86 2.76-2.47 3.87l-.02.15 3.58 2.77.25.02c2.28-2.1 3.58-5.2 3.58-8.54Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.06 7.95-2.9l-3.79-2.94c-1.02.71-2.4 1.2-4.16 1.2-3.18 0-5.88-2.1-6.84-5.02l-.14.01-3.72 2.88-.05.13C3.24 21.3 7.28 24 12 24Z"/><path fill="#FBBC05" d="M5.16 14.34a7.4 7.4 0 0 1-.4-2.34c0-.81.14-1.6.38-2.34l-.01-.16-3.77-2.93-.12.06A11.98 11.98 0 0 0 0 12c0 1.93.47 3.76 1.24 5.37l3.92-3.03Z"/><path fill="#EA4335" d="M12 4.75c2.25 0 3.77.97 4.64 1.79l3.38-3.3C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.24 6.63l3.9 3.03C6.12 6.85 8.82 4.75 12 4.75Z"/></svg>',
    yandex: '<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FC3F1D"/><path fill="#fff" d="M13.03 6.28h-1.36c-2.4 0-3.66 1.22-3.66 3.02 0 2.02 1.03 2.87 2.86 4.1l-3.18 4.8h2.13l3.1-4.7 1.02.05v4.65h1.9V6.28h-3.01ZM13.02 12.5l-.86-.04c-1.24 0-1.94-.6-1.94-2.18 0-1.5.75-2.15 1.94-2.15h.86v4.37Z"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  };
  return icons[name] || '';
}

const TITLES = {
  login: 'Вход в аккаунт',
  register: 'Создать аккаунт',
  forgot: 'Восстановление пароля',
  reset: 'Новый пароль',
};

const DESCS = {
  login: 'Один аккаунт для всех продуктов CodeNexa — данные и подписка синхронизируются между устройствами.',
  register: 'Один аккаунт для всех продуктов CodeNexa — данные и подписка синхронизируются между устройствами.',
  forgot: 'Укажите email, привязанный к аккаунту — пришлём код для сброса пароля.',
  reset: `Мы отправили 6-значный код на ${resetEmail || 'ваш email'}. Введите его вместе с новым паролем.`,
};

function render(root, onAuthed) {
  const isCredentialsMode = mode === 'login' || mode === 'register';
  const isRecoveryMode = mode === 'forgot' || mode === 'reset';

  const formFields = isCredentialsMode
    ? `
        <label class="auth-field">
          <span>Email</span>
          <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
        </label>
        <label class="auth-field">
          <span>Пароль</span>
          <input type="password" name="password" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" placeholder="Минимум 8 символов" />
        </label>
        ${mode === 'register' ? `
        <label class="auth-field">
          <span>Имя (необязательно)</span>
          <input type="text" name="firstName" autocomplete="given-name" placeholder="Как к вам обращаться" />
        </label>` : ''}
        ${pendingTotp ? `
        <label class="auth-field">
          <span>Код из приложения-аутентификатора</span>
          <input type="text" name="totpCode" inputmode="numeric" pattern="[0-9]*" placeholder="123456" />
        </label>` : ''}
        ${mode === 'login' ? `<button type="button" class="auth-link-btn" data-auth-forgot>Забыли пароль?</button>` : ''}`
    : mode === 'forgot'
      ? `
        <label class="auth-field">
          <span>Email</span>
          <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
        </label>`
      : `
        <label class="auth-field">
          <span>Код из письма</span>
          <input type="text" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" required autocomplete="one-time-code" placeholder="123456" />
        </label>
        <label class="auth-field">
          <span>Новый пароль</span>
          <input type="password" name="newPassword" required autocomplete="new-password" minlength="8" placeholder="Минимум 8 символов" />
        </label>`;

  const submitLabel = busy
    ? 'Секунду…'
    : { login: 'Войти', register: 'Зарегистрироваться', forgot: 'Отправить код', reset: 'Сбросить пароль' }[mode];

  root.innerHTML = `
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="auth-brand-mark">CN</div>
        <div class="auth-brand-name">CodeNexa</div>
      </div>
      <div class="auth-eyebrow">Личный кабинет</div>
      <div class="auth-title">${TITLES[mode]}</div>
      <div class="auth-desc">${DESCS[mode]}</div>

      ${isCredentialsMode && isRunningInsideTelegram() ? `
      <button class="auth-btn auth-btn-telegram" data-auth-telegram>
        ${icon('telegram')} <span>Продолжить с Telegram</span>
      </button>
      ` : ''}
      ${isCredentialsMode ? `
      <div class="auth-oauth-row">
        <button class="auth-btn auth-btn-oauth" data-auth-google>${icon('google')} <span>Google</span></button>
        <button class="auth-btn auth-btn-oauth" data-auth-yandex>${icon('yandex')} <span>Яндекс</span></button>
      </div>
      <div class="auth-divider"><span>или email</span></div>` : ''}

      <form class="auth-form" data-auth-form>
        ${formFields}

        ${errorMsg ? `<div class="auth-error">${errorMsg}</div>` : ''}
        ${successMsg ? `<div class="auth-success">${successMsg}</div>` : ''}

        <button type="submit" class="auth-btn auth-btn-primary" ${busy ? 'disabled' : ''}>
          ${submitLabel}
        </button>
      </form>

      <div class="auth-switch">
        ${mode === 'login'
          ? `Нет аккаунта? <button data-auth-switch>Зарегистрироваться</button>`
          : mode === 'register'
            ? `Уже есть аккаунт? <button data-auth-switch>Войти</button>`
            : `<button data-auth-switch>← Вернуться ко входу</button>`}
      </div>

      <div class="auth-legal">Продолжая, вы соглашаетесь с условиями использования и политикой конфиденциальности CodeNexa.</div>
    </div>
  </div>`;

  const finish = (result) => {
    setToken(result.token);
    haptic('medium');
    root.innerHTML = '';
    onAuthed(result.user);
  };

  const telegramBtn = root.querySelector('[data-auth-telegram]');
  if (telegramBtn) {
    telegramBtn.addEventListener('click', async () => {
      busy = true; errorMsg = ''; render(root, onAuthed);
      try {
        const result = await authApi.loginWithTelegram();
        finish(result);
      } catch (e) {
        busy = false; errorMsg = e.message || 'Не удалось войти через Telegram'; render(root, onAuthed);
      }
    });
  }

  const googleBtn = root.querySelector('[data-auth-google]');
  if (googleBtn) googleBtn.addEventListener('click', () => { openExternalLink(authApi.googleStartUrl()); });

  const yandexBtn = root.querySelector('[data-auth-yandex]');
  if (yandexBtn) yandexBtn.addEventListener('click', () => { openExternalLink(authApi.yandexStartUrl()); });

  const forgotBtn = root.querySelector('[data-auth-forgot]');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      mode = 'forgot'; errorMsg = ''; successMsg = ''; pendingTotp = false;
      render(root, onAuthed);
    });
  }

  root.querySelector('[data-auth-switch]').addEventListener('click', () => {
    mode = isRecoveryMode ? 'login' : (mode === 'login' ? 'register' : 'login');
    errorMsg = ''; successMsg = ''; pendingTotp = false; resetEmail = '';
    render(root, onAuthed);
  });

  root.querySelector('[data-auth-form]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);

    busy = true; errorMsg = ''; successMsg = ''; render(root, onAuthed);
    try {
      if (mode === 'login' || mode === 'register') {
        const email = fd.get('email');
        const password = fd.get('password');
        const firstName = fd.get('firstName');
        const totpCode = fd.get('totpCode');
        const result = mode === 'login'
          ? await authApi.login(email, password, totpCode || undefined)
          : await authApi.register(email, password, firstName || undefined);
        finish(result);
        return;
      }
      if (mode === 'forgot') {
        const email = fd.get('email');
        await authApi.forgotPassword(email);
        resetEmail = email;
        mode = 'reset';
        busy = false;
        render(root, onAuthed);
        return;
      }
      // mode === 'reset'
      const code = fd.get('code');
      const newPassword = fd.get('newPassword');
      await authApi.resetPassword(resetEmail, code, newPassword);
      mode = 'login';
      busy = false;
      successMsg = 'Пароль обновлён — теперь можно войти с новым паролем.';
      resetEmail = '';
      render(root, onAuthed);
    } catch (e) {
      busy = false;
      if (e.status === 401 && /2FA/.test(e.message)) {
        pendingTotp = true;
        errorMsg = e.message;
      } else {
        errorMsg = e.message || 'Что-то пошло не так';
      }
      render(root, onAuthed);
    }
  });
}

export function mountAuthCard(root, onAuthed) {
  mode = 'login'; busy = false; errorMsg = ''; successMsg = ''; pendingTotp = false; resetEmail = '';
  render(root, onAuthed);
}
