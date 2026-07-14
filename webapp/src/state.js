// Локальное состояние пользователя, которое не требует бэкенда — хранится в
// localStorage на устройстве (см. описание в src/config/legal.js, раздел
// Privacy Policy: "onboarding completion, the chosen interest, the list of
// connected products, a referral code, and an invite counter — none of this
// is sent to a server until a real backend is connected").
//
// Правило №1 проекта (честные пустые состояния) применяется и здесь: если
// localStorage недоступен (приватный режим, ограничения WebView), все
// функции тихо деградируют к пустым/нулевым значениям, а не бросают ошибку и
// не роняют интерфейс.

const KEYS = {
  connected: 'codenexa_connected_products_v1',
  onboardingDone: 'codenexa_onboarding_done_v1',
  onboardingInterest: 'codenexa_onboarding_interest_v1',
  referralCode: 'codenexa_referral_code_v1',
  invitedCount: 'codenexa_invited_count_v1',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно — не критично, просто не переживёт перезагрузку */
  }
}

// ---------- подключённые продукты ----------

export function isConnected(productId) {
  return readJSON(KEYS.connected, []).includes(productId);
}

export function connectProduct(productId) {
  const list = readJSON(KEYS.connected, []);
  if (!list.includes(productId)) {
    list.push(productId);
    writeJSON(KEYS.connected, list);
  }
}

export function disconnectProduct(productId) {
  writeJSON(KEYS.connected, readJSON(KEYS.connected, []).filter((id) => id !== productId));
}

export function connectedCount() {
  return readJSON(KEYS.connected, []).length;
}

// ---------- онбординг ----------

export function isOnboardingComplete() {
  try {
    return localStorage.getItem(KEYS.onboardingDone) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingComplete(interest) {
  try {
    localStorage.setItem(KEYS.onboardingDone, '1');
    if (interest) localStorage.setItem(KEYS.onboardingInterest, interest);
  } catch {
    /* non-fatal */
  }
}

// ---------- реферальная программа (локальная часть) ----------
// Код детерминирован от Telegram ID, если он есть (не требует бэкенда, чтобы
// показать пользователю его ссылку) — иначе генерируется один раз и хранится
// локально, чтобы не менялся между визитами.

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getReferralCode(telegramId) {
  if (telegramId) return String(telegramId);
  try {
    let code = localStorage.getItem(KEYS.referralCode);
    if (!code) {
      code = randomCode();
      localStorage.setItem(KEYS.referralCode, code);
    }
    return code;
  } catch {
    return randomCode();
  }
}

// Честно 0, пока не подключён реальный подсчёт с бэкенда (см. app/web/api/referrals.py)
// — не выдумываем число, следуя тому же принципу, что и metric.value === null в products.js.
export function getInvitedCount() {
  try {
    return Number(localStorage.getItem(KEYS.invitedCount) || '0') || 0;
  } catch {
    return 0;
  }
}
