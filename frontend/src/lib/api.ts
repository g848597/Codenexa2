import { getInitData } from "./telegram";

// В деплое задаётся через .env (VITE_API_BASE_URL) — сервис отдельный от
// фронтенда (см. README.md бэкенда, "CORS обязателен"). Для локальной
// разработки по умолчанию бьём в uvicorn на 8001 порту.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const initData = getInitData();
  if (initData) headers.set("Authorization", `tma ${initData}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.detail ?? body);
  return body as T;
}

export interface UsernameCheckResult {
  username: string;
  status: "free" | "taken" | "invalid" | "unknown";
  error: string | null;
  profile_url: string | null;
}

export function checkUsername(username: string): Promise<UsernameCheckResult> {
  return request(`/api/tools/username-checker?username=${encodeURIComponent(username)}`);
}

export interface DeepLinkResult {
  ok: true;
  url: string;
  bot_username: string;
  link_type: string;
  param: string;
}

export function buildDeepLink(body: {
  bot_username: string;
  link_type: string;
  param: string;
}): Promise<DeepLinkResult> {
  return request("/api/tools/deep-link-builder", { method: "POST", body: JSON.stringify(body) });
}

export function generateBio(body: {
  niche: string;
  tone: string;
  keywords?: string;
  length: "short" | "medium";
}): Promise<{ variants: string[] }> {
  return request("/api/tools/bio-generator", { method: "POST", body: JSON.stringify(body) });
}

/** Универсальная запись в Smart History — общая для всех модулей
 * (app/api/history.py на бэкенде), отдельных per-модульных эндпоинтов нет.
 * Требует активный проект: MVP этой страницы использует дефолтный проект
 * пользователя, так как переключатель проектов — часть Core Foundation UI,
 * которая в этом чате не собиралась. */
export function saveToHistory(
  projectId: number,
  body: { module_key: string; title?: string; payload: unknown; result_text?: string; result_url?: string },
) {
  return request(`/api/projects/${projectId}/history`, { method: "POST", body: JSON.stringify(body) });
}

export function getMe(): Promise<{ id: number; telegram_id: number }> {
  return request("/api/me");
}

export function listProjects(): Promise<{ projects: Array<{ id: number; is_active_default: boolean }> }> {
  return request("/api/projects");
}

// ---------- 3.6 URL Shortener ----------

export interface ShortLink {
  id: number;
  slug: string;
  short_url: string;
  original_url: string;
  clicks: number;
  created_at: string;
}

export function shortenUrl(projectId: number, originalUrl: string): Promise<{ short_link: ShortLink }> {
  return request("/api/tools/url-shortener", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, original_url: originalUrl }),
  });
}

export function listShortLinks(projectId: number): Promise<{ short_links: ShortLink[] }> {
  return request(`/api/projects/${projectId}/short-links`);
}

// ---------- Brand Kit (Этап 1) — читается разделом «Контент», Этап 4 ----------

export interface BrandKit {
  id: number;
  project_id: number;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  brand_emojis: string[];
  tone_of_voice: string | null;
  updated_at: string;
}

export function getBrandKit(projectId: number): Promise<{ brand_kit: BrandKit }> {
  return request(`/api/projects/${projectId}/brand-kit`);
}

export function updateBrandKit(
  projectId: number,
  fields: Partial<Pick<BrandKit, "primary_color" | "secondary_color" | "accent_color">>,
): Promise<{ brand_kit: BrandKit }> {
  return request(`/api/projects/${projectId}/brand-kit`, { method: "PUT", body: JSON.stringify(fields) });
}

// ---------- Раздел «Дизайн» (Этап 5) ----------

/** Единая точка загрузки для всех 6 canvas-модулей раздела «Дизайн» —
 * см. app/api/design.py. dataUrl — результат `canvas.toDataURL()`. */
export function uploadDesignAsset(
  projectId: number,
  moduleKey: string,
  filename: string,
  dataUrl: string,
): Promise<{ url: string }> {
  return request("/api/tools/design-upload", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, module_key: moduleKey, filename, data_base64: dataUrl }),
  });
}

// ---------- Раздел «Контент» (Этап 4) ----------

export interface PostConstructorResult {
  post_type: string;
  post_type_label: string;
  sections: { key: string; label: string; text: string }[];
  emojis: string[];
  text: string;
}

export function buildPost(body: {
  post_type: string;
  topic: string;
  theses: string[];
  tone: string;
  brand_emojis: string[];
}): Promise<PostConstructorResult> {
  return request("/api/tools/post-constructor", { method: "POST", body: JSON.stringify(body) });
}

export function buildWelcomeMessage(body: {
  channel_name: string;
  perks: string[];
  rules_short?: string;
  tone: string;
}): Promise<{ text: string }> {
  return request("/api/tools/welcome-message", { method: "POST", body: JSON.stringify(body) });
}

export interface GroupRulesCatalog {
  standard_rules: { key: string; label: string }[];
  community_types: { key: string; label: string }[];
}

export function getGroupRulesCatalog(): Promise<GroupRulesCatalog> {
  return request("/api/tools/group-rules/catalog");
}

export function buildGroupRules(body: {
  community_type: string;
  standard_rule_keys: string[];
  custom_rules: string[];
}): Promise<{ community_type: string; community_type_label: string; rules: string[]; text: string }> {
  return request("/api/tools/group-rules", { method: "POST", body: JSON.stringify(body) });
}

export function generateHeadlines(topic: string, count: 3 | 5 | 10): Promise<{ headlines: string[] }> {
  return request(`/api/tools/headline-generator?topic=${encodeURIComponent(topic)}&count=${count}`);
}

export function generateCta(body: { goal: string; tone: string }): Promise<{ variants: string[] }> {
  return request("/api/tools/cta-generator", { method: "POST", body: JSON.stringify(body) });
}

export function generateHashtags(
  niche: string,
  category: string,
  count: 5 | 10 | 15,
): Promise<{ hashtags: string[] }> {
  return request(
    `/api/tools/hashtag-generator?niche=${encodeURIComponent(niche)}&category=${encodeURIComponent(category)}&count=${count}`,
  );
}

// ---------- Smart History (Этап 1) — используется страницей /history,
// добавленной в Этапе 6 для DoD "из Smart History можно одним действием
// создать запись в контент-плане" (см. app/api/history.py) ----------

export interface HistoryItem {
  id: number;
  project_id: number;
  module_key: string;
  title: string | null;
  payload: unknown;
  result_url: string | null;
  result_text: string | null;
  is_favorite: boolean;
  created_at: string;
}

export function listHistory(
  projectId: number,
  opts?: { module?: string; favorites?: boolean },
): Promise<{ items: HistoryItem[] }> {
  const params = new URLSearchParams();
  if (opts?.module) params.set("module", opts.module);
  if (opts?.favorites) params.set("favorites", "true");
  const qs = params.toString();
  return request(`/api/projects/${projectId}/history${qs ? `?${qs}` : ""}`);
}

export function toggleHistoryFavorite(
  projectId: number,
  itemId: number,
  isFavorite: boolean,
): Promise<{ item: HistoryItem }> {
  return request(`/api/projects/${projectId}/history/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
}

export function deleteHistoryItem(projectId: number, itemId: number): Promise<{ deleted: true }> {
  return request(`/api/projects/${projectId}/history/${itemId}`, { method: "DELETE" });
}

// ---------- Раздел «Рост» (Этап 6) ----------

export interface ContentPlanItem {
  id: number;
  project_id: number;
  title: string;
  status: "idea" | "in_progress" | "done" | "published";
  planned_date: string | null;
  linked_generated_item_id: number | null;
  created_at: string;
}

/** 6.1 Контент-план и 6.2 Календарь читают один и тот же список — календарь
 * передаёт withDateOnly: true, чтобы не тянуть карточки без даты. */
export function listContentPlan(
  projectId: number,
  opts?: { status?: string; withDateOnly?: boolean },
): Promise<{ items: ContentPlanItem[] }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.withDateOnly) params.set("with_date_only", "true");
  const qs = params.toString();
  return request(`/api/projects/${projectId}/content-plan${qs ? `?${qs}` : ""}`);
}

export function createContentPlanItem(
  projectId: number,
  body: {
    title: string;
    status?: string;
    planned_date?: string | null;
    linked_generated_item_id?: number | null;
  },
): Promise<{ item: ContentPlanItem }> {
  return request(`/api/projects/${projectId}/content-plan`, { method: "POST", body: JSON.stringify(body) });
}

export function updateContentPlanItem(
  projectId: number,
  itemId: number,
  body: { title?: string; status?: string; planned_date?: string | null; clear_planned_date?: boolean },
): Promise<{ item: ContentPlanItem }> {
  return request(`/api/projects/${projectId}/content-plan/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteContentPlanItem(projectId: number, itemId: number): Promise<{ deleted: true }> {
  return request(`/api/projects/${projectId}/content-plan/${itemId}`, { method: "DELETE" });
}

// ---------- 6.3 Генератор идей постов ----------

export interface IdeaCard {
  category: string;
  category_label: string;
  text: string;
}

export function generateIdeas(niche: string, count: 5 | 10): Promise<{ ideas: IdeaCard[] }> {
  return request(`/api/tools/idea-generator?niche=${encodeURIComponent(niche)}&count=${count}`);
}

// ---------- 6.4 Генератор опросов/викторин ----------

export interface PollQuizResult {
  type: "poll" | "quiz";
  type_label: string;
  question: string;
  options: string[];
  correct_index: number | null;
  copy_text: string;
}

export function buildPollQuiz(body: {
  type: "poll" | "quiz";
  question: string;
  options: string[];
  correct_index?: number | null;
}): Promise<PollQuizResult> {
  return request("/api/tools/poll-quiz-builder", { method: "POST", body: JSON.stringify(body) });
}
