import { useEffect } from "react";

/**
 * Wires up window.Telegram.WebApp (the Telegram Mini App SDK) when the app
 * is actually running inside Telegram. Everywhere else (a normal desktop
 * browser during development, for instance) this quietly no-ops — every
 * call is guarded, so the app works identically outside Telegram.
 */
export function useTelegramWebApp() {
  useEffect(() => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    if (!tg) return;

    tg.ready();
    tg.expand();

    applyThemeParams(tg);
    tg.onEvent?.("themeChanged", () => applyThemeParams(tg));

    // Keep viewport-driven layout in sync as Telegram's chrome resizes
    // (keyboard open/close, safe-area changes on iOS).
    const applyViewportHeight = () => {
      const h = tg.viewportStableHeight || tg.viewportHeight;
      if (h) document.documentElement.style.setProperty("--tg-viewport-height", `${h}px`);
    };
    applyViewportHeight();
    tg.onEvent?.("viewportChanged", applyViewportHeight);

    return () => {
      tg.offEvent?.("themeChanged", applyThemeParams);
      tg.offEvent?.("viewportChanged", applyViewportHeight);
    };
  }, []);
}

function applyThemeParams(tg) {
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  // Only override our dark-glass defaults when Telegram actually supplies
  // values — falls back to the app's own palette otherwise.
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--text-dim", p.hint_color);
  if (p.button_color) root.setProperty("--violet", p.button_color);
  if (p.secondary_bg_color) root.setProperty("--glass", p.secondary_bg_color);
  try { tg.setHeaderColor?.(p.bg_color ? "bg_color" : "secondary_bg_color"); } catch {}
}

/** Wire Telegram's hardware/back-button to an in-app "go back" handler. */
export function useTelegramBackButton(onBack) {
  useEffect(() => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    if (!tg?.BackButton) return;
    if (onBack) {
      tg.BackButton.show();
      tg.BackButton.onClick(onBack);
    } else {
      tg.BackButton.hide();
    }
    return () => { try { tg.BackButton.offClick(onBack); } catch {} };
  }, [onBack]);
}

/** Wire Telegram's MainButton to a primary screen action (e.g. "Save"). */
export function useTelegramMainButton(config) {
  useEffect(() => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    if (!tg?.MainButton) return;
    if (!config) { tg.MainButton.hide(); return; }
    const { text, onClick, disabled = false, color } = config;
    tg.MainButton.setText(text);
    if (color) tg.MainButton.setParams?.({ color });
    disabled ? tg.MainButton.disable() : tg.MainButton.enable();
    tg.MainButton.show();
    tg.MainButton.onClick(onClick);
    return () => { try { tg.MainButton.offClick(onClick); tg.MainButton.hide(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.text, config?.onClick, config?.disabled, config?.color]);
}

/** Haptic feedback on key interactions (status change, delete, send). No-ops outside Telegram. */
export function haptic(kind = "light") {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  const h = tg?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === "success" || kind === "error" || kind === "warning") h.notificationOccurred(kind);
    else if (kind === "select") h.selectionChanged();
    else h.impactOccurred(kind); // "light" | "medium" | "heavy" | "rigid" | "soft"
  } catch {}
}
