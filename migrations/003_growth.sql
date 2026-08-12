-- Telegram Toolkit — Этап 6 (Раздел «Рост»)
-- Схема соответствует 06-growth.md, 6.1 Контент-план.
-- Единственная новая таблица раздела — 6.2 Календарь публикаций явно НЕ
-- заводит отдельную таблицу (по спеке: "это тот же источник данных, что и
-- 6.1"), а просто другое представление content_plan_items на фронтенде,
-- отфильтрованное по заполненному planned_date (см. app/api/growth.py).
-- 6.3 Генератор идей пишет сюда же по кнопке «В контент-план», 6.4 Генератор
-- опросов/викторин использует уже существующую generated_items (Этап 1).

CREATE TABLE IF NOT EXISTS content_plan_items (
    id                        BIGSERIAL PRIMARY KEY,
    project_id                BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title                     TEXT NOT NULL,
    -- 'idea' | 'in_progress' | 'done' | 'published' — колонки канбана 6.1
    -- (Идея → В работе → Готово → Опубликовано). Валидируется в Python
    -- (repo.CONTENT_PLAN_STATUSES), без CHECK-ограничения — тот же подход,
    -- что и tone_of_voice в brand_kits (Этап 1).
    status                    TEXT NOT NULL DEFAULT 'idea',
    planned_date              DATE,
    -- Карточку можно создать вручную ИЛИ превратить в неё элемент из Smart
    -- History (кнопка «В контент-план») — тогда сюда пишется id исходной
    -- записи. ON DELETE SET NULL: если запись истории удалили, карточка
    -- контент-плана остаётся (это уже самостоятельный план, а не ссылка).
    linked_generated_item_id  BIGINT REFERENCES generated_items(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Канбан (6.1) почти всегда читает все карточки проекта, иногда с фильтром
-- по статусу (колонка) — составной индекс покрывает оба паттерна.
CREATE INDEX IF NOT EXISTS idx_content_plan_items_project_status
    ON content_plan_items(project_id, status);

-- Календарь (6.2) читает только карточки с заполненной датой — частичный
-- индекс меньше и быстрее полного, т.к. не все карточки имеют дату.
CREATE INDEX IF NOT EXISTS idx_content_plan_items_project_planned_date
    ON content_plan_items(project_id, planned_date) WHERE planned_date IS NOT NULL;
