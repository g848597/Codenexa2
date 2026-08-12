-- Telegram Toolkit — Этап 3 (Utility)
-- Схема соответствует 03-utility.md, 3.6 URL Shortener.
-- Единственный модуль раздела Utility с собственной таблицей — остальные 5
-- модулей (3.1-3.5) либо чисто клиентские, либо используют существующую
-- generated_items (см. app/repo.py, "utility" секцию).

CREATE TABLE IF NOT EXISTS short_links (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_url    TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,   -- 6 символов, base62
    clicks           BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Слаг — публичный ключ поиска для GET /r/:slug (без project_id в пути),
-- поэтому уникальный индекс по нему обязателен и является основным путём
-- доступа на редиректе.
CREATE UNIQUE INDEX IF NOT EXISTS uq_short_links_slug ON short_links(slug);

-- Список ссылок проекта листается по created_at так же, как generated_items.
CREATE INDEX IF NOT EXISTS idx_short_links_project_created
    ON short_links(project_id, created_at DESC);
