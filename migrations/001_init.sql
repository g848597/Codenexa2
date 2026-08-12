-- Telegram Toolkit — Этап 1 (Core Foundation)
-- Схема соответствует 01-core-foundation.md
-- Совместимо с PostgreSQL 13+ (Supabase).

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE NOT NULL,
    username        TEXT,
    first_name      TEXT,
    language        TEXT NOT NULL DEFAULT 'ru',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    is_active_default   BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ  -- soft delete (см. DELETE /projects/:id в спеке)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id) WHERE deleted_at IS NULL;

-- Ровно один "дефолтный активный" проект на пользователя среди неудалённых —
-- защищает от рассинхрона при параллельных запросах на переключение проекта.
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_one_default_per_user
    ON projects(user_id)
    WHERE is_active_default = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS brand_kits (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    logo_url        TEXT,
    primary_color   TEXT,   -- hex, напр. "#5B8DEF"
    secondary_color TEXT,
    accent_color    TEXT,
    font_family     TEXT,
    brand_emojis    TEXT[] NOT NULL DEFAULT '{}',
    tone_of_voice   TEXT,   -- 'friendly' | 'expert' | 'sales' | 'official'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_items (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_key      TEXT NOT NULL,
    title           TEXT,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_url      TEXT,
    result_text     TEXT,
    is_favorite     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- История листается по проекту почти всегда, часто ещё и с фильтром по модулю
-- и сортировкой по дате — один составной индекс покрывает оба паттерна.
CREATE INDEX IF NOT EXISTS idx_generated_items_project_created
    ON generated_items(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_items_project_module
    ON generated_items(project_id, module_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_items_favorite
    ON generated_items(project_id, is_favorite) WHERE is_favorite = true;

CREATE TABLE IF NOT EXISTS templates (
    id          BIGSERIAL PRIMARY KEY,
    category    TEXT NOT NULL,   -- совпадает с module_key или разделом
    title       TEXT NOT NULL,
    content     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,  -- NULL для системных шаблонов
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id) WHERE user_id IS NOT NULL;
