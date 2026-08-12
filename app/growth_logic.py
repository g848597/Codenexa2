"""Бизнес-логика раздела «Рост» (Этап 6, см. 06-growth.md), без привязки к
FastAPI/HTTP — тот же паттерн, что content_logic.py для Этапа 4: роуты в
app/api/growth.py только вызывают эти функции.

6.3 Генератор идей постов работает через уже существующий шаблонный движок
app/content_engine.py (register/generate_many) — движок нарочно "глупый" и
не привязан к разделу «Контент» персонально (см. docstring content_engine.py:
"не знает ничего про Telegram/посты/CTA, только подстановка переменных"),
поэтому переиспользуется здесь без изменений, вместо второй копии той же
механики подстановки {niche} в паттерны.

6.4 Генератор опросов/викторин — чистая валидация + сборка текстового
представления, без шаблонного движка (нет банка фраз, только структура
"вопрос + варианты"), MVP без прямой интеграции с Bot API (см. 06-growth.md).
"""
import random

from app import content_engine as engine

# =====================================================================
# 6.3 Генератор идей постов
# =====================================================================

IDEA_CATEGORIES = [
    "storytelling",
    "expert_tip",
    "behind_scenes",
    "case_study",
    "audience_question",
    "digest",
    "comparison",
    "myth_vs_fact",
]

IDEA_CATEGORY_LABELS: dict[str, str] = {
    "storytelling": "Сторителлинг",
    "expert_tip": "Экспертный совет",
    "behind_scenes": "Закулисье",
    "case_study": "Кейс",
    "audience_question": "Вопрос аудитории",
    "digest": "Дайджест",
    "comparison": "Сравнение",
    "myth_vs_fact": "Миф vs факт",
}

engine.register("idea_storytelling", [
    "Расскажите историю о том, как вы начали заниматься «{niche}» — с чего всё началось",
    "Опишите провал в «{niche}», который многому научил, и что вы поняли",
    "Поделитесь историей клиента или подписчика, которая показывает силу «{niche}»",
    "Расскажите, как обычный день в «{niche}» обернулся неожиданным уроком",
])
engine.register("idea_expert_tip", [
    "Дайте 3 практических совета новичкам в «{niche}»",
    "Разберите одну частую ошибку в «{niche}» и как её избежать",
    "Поделитесь лайфхаком, который экономит время в «{niche}»",
    "Объясните простыми словами один сложный термин из «{niche}»",
])
engine.register("idea_behind_scenes", [
    "Покажите, как выглядит ваш рабочий процесс в «{niche}» изнутри",
    "Расскажите, что происходит за кадром перед запуском нового в «{niche}»",
    "Познакомьте аудиторию с командой или инструментами, которые стоят за «{niche}»",
    "Покажите черновик или рабочую версию проекта в «{niche}» до финального результата",
])
engine.register("idea_case_study", [
    "Разберите реальный кейс с результатами в «{niche}»: что было, что сделали, что получили",
    "Сравните показатели до и после внедрения подхода в «{niche}»",
    "Расскажите пошагово, как решили конкретную задачу клиента в «{niche}»",
    "Покажите цифры одного успешного проекта в «{niche}»",
])
engine.register("idea_audience_question", [
    "Спросите подписчиков, с какой проблемой в «{niche}» они сталкиваются чаще всего",
    "Проведите опрос: что из «{niche}» интересует аудиторию больше всего",
    "Задайте вопрос: какой совет по «{niche}» подписчики хотели бы получить",
    "Спросите, какой формат контента про «{niche}» заходит лучше всего",
])
engine.register("idea_digest", [
    "Соберите дайджест из 5 полезных материалов по «{niche}» за последнюю неделю",
    "Подведите итоги месяца в «{niche}»: что изменилось, что важно знать",
    "Сделайте подборку лучших постов канала на тему «{niche}»",
    "Соберите топ-3 новости из мира «{niche}» за последнее время",
])
engine.register("idea_comparison", [
    "Сравните два подхода к «{niche}» и разберите плюсы и минусы каждого",
    "Покажите «{niche}» в формате «раньше vs сейчас» — что изменилось",
    "Сравните бесплатный и платный вариант в «{niche}»",
    "Разберите, что выбрать новичку в «{niche}»: вариант А или вариант Б",
])
engine.register("idea_myth_vs_fact", [
    "Развейте один популярный миф о «{niche}»",
    "Разберите 3 мифа и 3 факта про «{niche}»",
    "Расскажите, во что многие ошибочно верят в «{niche}» — и как на самом деле",
    "Проверьте расхожее убеждение про «{niche}» на прочность",
])

_IDEA_TEMPLATE_KEYS = [f"idea_{key}" for key in IDEA_CATEGORIES]


def generate_ideas(niche: str, count: int, rng: random.Random | None = None) -> list[dict]:
    """6.3 — обходит категории по кругу (как generate_headlines в
    content_logic.py, Этап 4), чтобы выдача была максимально разнотипной, а
    не несколько идей подряд из одной категории. count ограничен на уровне
    app/api/growth.py до 5/10 (по спеке 6.3)."""
    rng = rng or random
    variables = {"niche": niche}
    pools = {key: engine.generate_many(key, variables, count=99, rng=rng) for key in _IDEA_TEMPLATE_KEYS}
    result: list[dict] = []
    while len(result) < count and any(pools.values()):
        for key in _IDEA_TEMPLATE_KEYS:
            if len(result) >= count:
                break
            if pools[key]:
                category = key[len("idea_"):]
                result.append({
                    "category": category,
                    "category_label": IDEA_CATEGORY_LABELS[category],
                    "text": pools[key].pop(0),
                })
    return result


# =====================================================================
# 6.4 Генератор опросов/викторин
# =====================================================================

POLL_TYPES = {"poll", "quiz"}

POLL_TYPE_LABELS = {"poll": "Опрос", "quiz": "Викторина"}

# Лимиты Telegram-опросов (Bot API sendPoll): question ≤ 300, до 10
# вариантов, каждый вариант ≤ 100 символов. MIN_OPTIONS = 2 — нативный
# минимум для любого голосования.
MIN_OPTIONS = 2
MAX_OPTIONS = 10
MAX_OPTION_LENGTH = 100
MAX_QUESTION_LENGTH = 300


def build_poll_quiz(poll_type: str, question: str, options: list[str],
                     correct_index: int | None = None) -> dict:
    """6.4 — предполагает, что валидация лимитов уже прошла в
    app/api/growth.py (единообразно с build_group_rules/build_post в
    content_logic.py, где enum-валидация тоже на уровне роута, а сюда
    доезжают только допустимые значения); здесь только защитная проверка
    типа на случай прямого вызова функции в обход роута."""
    if poll_type not in POLL_TYPES:
        raise ValueError(f"Неизвестный тип: {poll_type}")

    lines = [question, ""]
    for i, option in enumerate(options):
        is_correct = poll_type == "quiz" and correct_index == i
        marker = "✅" if is_correct else "▫️"
        lines.append(f"{marker} {option}")
    copy_text = "\n".join(lines)

    return {
        "type": poll_type,
        "type_label": POLL_TYPE_LABELS[poll_type],
        "question": question,
        "options": options,
        "correct_index": correct_index if poll_type == "quiz" else None,
        "copy_text": copy_text,
    }
