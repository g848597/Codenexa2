import { safeGet, safeSet } from "./storageClient";
import { scopedKey } from "./workspace";
import { COMPANY } from "../data/mockData";

const SETTINGS_KEY = "settings:company";

export const CURRENCIES = {
  KZT: { symbol: "₸", label: "Тенге (₸)" },
  USD: { symbol: "$", label: "Доллар ($)" },
  EUR: { symbol: "€", label: "Евро (€)" },
};

export const DEFAULT_SETTINGS = {
  profile: { name: COMPANY.name, legal: COMPANY.legal, bin: COMPANY.bin },
  plan: COMPANY.plan,
  brandAccent: "#6E6AF6",
  theme: "dark",
  currency: "KZT",
  integrations: {
    telegramBot: true,
    oneC: false,
    emailMarketing: true,
  },
};

export async function loadCompanySettings() {
  const key = await scopedKey(SETTINGS_KEY);
  const raw = await safeGet(key, false);
  if (raw === undefined) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveCompanySettings(settings) {
  const key = await scopedKey(SETTINGS_KEY);
  return safeSet(key, JSON.stringify(settings), false);
}
