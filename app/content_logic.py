"""Бизнес-логика раздела «Контент» (Этап 4, см. 04-content.md), без
привязки к FastAPI/HTTP — тот же паттерн, что telegram_tools_logic.py для
Этапа 2: роуты в app/api/content.py только вызывают эти функции.

Все генераторы работают через app/content_engine.py (шаблонный движок,
MVP без AI — см. примечание в конце 04-content.md про будущий AI Writer).
Здесь регистрируются банки паттернов и живёт вся структурная логика:
скелеты постов, распределение тезисов по секциям, матрица CTA
цель×тон, категории хештегов и т.д.
"""
import random
import re

from app import content_engine as engine

# Тон — те же 4 значения, что Brand Kit (app/api/brand_kit.py VALID_TONES),
# намеренно не импортируем оттуда напрямую (api-модуль не должен быть
# зависимостью бизнес-логики) — значения продублированы и должны совпадать.
CONTENT_TONES = {"friendly", "expert", "sales", "official"}
_DEFAULT_TONE = "friendly"


def _dedupe_ci(items: list[str]) -> list[str]:
    """Убирает дубли без учёта регистра, сохраняя порядок первого вхождения."""
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


# =====================================================================
# 4.5 Генератор CTA/призывов — регистрируется первым, т.к. 4.1 Конструктор
# постов переиспользует generate_cta_variants() напрямую как подшаг.
# =====================================================================

CTA_GOALS = {"subscribe", "follow_link", "message", "buy", "poll"}

_CTA_GOAL_LABELS = {
    "subscribe": "подписаться",
    "follow_link": "перейти по ссылке",
    "message": "написать в личку",
    "buy": "купить",
    "poll": "поучаствовать в опросе",
}

# Банк фраз-паттернов на каждую цель — тональность накладывается отдельным
# "обёртывающим" слоем (_CTA_TONE_WRAP), так что итоговая матрица — это
# цель × тон, как и требует спека, без явного дублирования 5×4 фраз.
_CTA_GOAL_CORE_PHRASES: dict[str, list[str]] = {
    "subscribe": [
        "Подпишись, чтобы не пропустить новое",
        "Присоединяйся — впереди много интересного",
        "Жми «Подписаться» прямо сейчас",
        "Оставайся с нами, подписка того стоит",
        "Подписка — лучший способ быть в курсе",
    ],
    "follow_link": [
        "Переходи по ссылке и смотри сам",
        "Подробности — по ссылке",
        "Жми на ссылку, там всё по делу",
        "Полная версия — по ссылке ниже",
        "Узнай больше по ссылке в посте",
    ],
    "message": [
        "Напиши в личку — ответим быстро",
        "Пиши в директ, обсудим детали",
        "В личных сообщениях расскажем подробнее",
        "Есть вопросы? Пиши в личку",
        "Напиши нам, разберёмся вместе",
    ],
    "buy": [
        "Оформи заказ прямо сейчас",
        "Забронируй по текущей цене",
        "Купи, пока предложение действует",
        "Оформляй — доставим быстро",
        "Забирай, пока не раскупили",
    ],
    "poll": [
        "Прими участие в опросе",
        "Голосуй в опросе ниже",
        "Оставь свой голос в опросе",
        "Твоё мнение важно — участвуй в опросе",
        "Ответь на пару вопросов в опросе",
    ],
}

# Обёртка тона — только текст, без эмодзи: эмодзи в CTA намеренно не
# добавляем здесь, чтобы 4.1 (который дописывает 2-3 фирменных эмодзи из
# Brand Kit в конце поста) не задваивал их с "зашитыми" в тон эмодзи.
_CTA_TONE_WRAP: dict[str, tuple[str, str]] = {
    "friendly": ("", "!"),
    "expert": ("", " — проверенный шаг."),
    "sales": ("Успей: ", "!"),
    "official": ("", ". Благодарим за внимание."),
}


def generate_cta_variants(goal: str, tone: str, count: int = 3, rng: random.Random | None = None) -> list[str]:
    """4.5 — возвращает `count` непохожих CTA-фраз под цель × тон.
    Используется и отдельным эндпоинтом, и как подшаг из 4.1."""
    core = _CTA_GOAL_CORE_PHRASES.get(goal)
    if not core:
        raise ValueError(f"Неизвестная цель CTA: {goal}")
    prefix, suffix = _CTA_TONE_WRAP.get(tone, ("", ""))
    pool = list(core)
    (rng or random).shuffle(pool)
    return [f"{prefix}{phrase}{suffix}" for phrase in pool[:count]]


# =====================================================================
# 4.1 Конструктор постов
# =====================================================================

POST_TYPES = {"announcement", "news", "sales", "personal"}

_POST_TYPE_LABELS = {
    "announcement": "анонс",
    "news": "новость",
    "sales": "продающий",
    "personal": "личный",
}

# Скелет секций под каждый тип — порядок важен, "hook" и "cta" не берут
# тезисы пользователя (генерируются отдельно), остальные — контентные
# секции, между которыми распределяются тезисы.
_POST_SKELETONS: dict[str, list[str]] = {
    "announcement": ["hook", "details", "cta"],
    "news": ["hook", "facts", "cta"],
    "sales": ["hook", "problem", "solution", "proof", "cta"],
    "personal": ["hook", "story", "cta"],
}

_SECTION_LABELS_RU = {
    "hook": "Хук",
    "details": "Детали",
    "facts": "Факты",
    "problem": "Проблема",
    "solution": "Решение",
    "proof": "Доказательство",
    "story": "История",
    "cta": "CTA",
}

# CTA-цель по умолчанию для каждого типа поста (4.5 как подшаг 4.1).
_POST_TYPE_CTA_GOAL = {
    "announcement": "subscribe",
    "news": "follow_link",
    "sales": "buy",
    "personal": "message",
}

engine.register("post_hook_announcement", [
    "🎉 Важное объявление: {topic}",
    "Свершилось! {topic}",
    "Спешим поделиться: {topic}",
    "Объявляем: {topic}",
])
engine.register("post_hook_news", [
    "Новость: {topic}",
    "Только что: {topic}",
    "Свежие данные по теме «{topic}»",
    "Событие дня: {topic}",
])
engine.register("post_hook_sales", [
    "Ищете решение для «{topic}»?",
    "{topic} — то, что вам нужно",
    "Хватит терпеть проблемы с «{topic}»",
    "Пора разобраться с «{topic}» раз и навсегда",
])
engine.register("post_hook_personal", [
    "Личное: {topic}",
    "Хочу рассказать про {topic}",
    "Сегодня — о {topic}",
    "Давно хотел(а) поделиться про {topic}",
])

# Заполнители для контентных секций, если пользователь не добавил тезисы —
# по одному банку на секцию (не на тип поста, секции переиспользуются).
engine.register("post_fill_details", [
    "Подробности собрали в этом посте — читайте и делитесь мнением про {topic}.",
    "Все детали о {topic} — ниже, коротко и по делу.",
])
engine.register("post_fill_facts", [
    "Главное о {topic}: разбираемся, что изменилось и почему это важно.",
    "Собрали ключевые факты про {topic} в одном месте.",
])
engine.register("post_fill_problem", [
    "Знакомая ситуация с «{topic}»? Вы не одни сталкиваетесь с этим.",
    "«{topic}» — частая головная боль, и вот почему она возникает.",
])
engine.register("post_fill_solution", [
    "Вот как мы решаем вопрос «{topic}» — просто и без лишних шагов.",
    "Решение для «{topic}» уже готово — рассказываем, как это работает.",
])
engine.register("post_fill_proof", [
    "Уже проверено на практике — результаты по «{topic}» говорят сами за себя.",
    "Не просто слова: показываем реальные результаты по теме «{topic}».",
])
engine.register("post_fill_story", [
    "Вот что произошло, когда я занялся(лась) темой «{topic}»…",
    "История про {topic}, которой давно хотел(а) поделиться.",
])

_FALLBACK_TEMPLATE_BY_SECTION = {
    "details": "post_fill_details",
    "facts": "post_fill_facts",
    "problem": "post_fill_problem",
    "solution": "post_fill_solution",
    "proof": "post_fill_proof",
    "story": "post_fill_story",
}

_DEFAULT_FALLBACK_EMOJIS = ["✨", "🔥", "📌", "💬", "🚀", "👀"]


def _distribute_theses(theses: list[str], sections: list[str]) -> dict[str, list[str]]:
    """Раскладывает тезисы по контентным секциям по кругу (round-robin) —
    первый тезис в первую секцию, второй во вторую и т.д., по кругу."""
    result: dict[str, list[str]] = {s: [] for s in sections}
    if not sections:
        return result
    for i, thesis in enumerate(theses):
        section = sections[i % len(sections)]
        result[section].append(thesis.strip())
    return result


def pick_brand_emojis(brand_emojis: list[str] | None, count_range: tuple[int, int] = (2, 3),
                       rng: random.Random | None = None) -> list[str]:
    """2-3 фирменных эмодзи из Brand Kit; если Brand Kit пуст — берём из
    небольшого дефолтного пула, чтобы пост не оставался совсем без
    эмодзи (спека подразумевает Brand Kit обязателен, но защищаемся от
    пустого списка на случай, если пользователь его не заполнил)."""
    rng = rng or random
    source = [e for e in (brand_emojis or []) if e.strip()] or _DEFAULT_FALLBACK_EMOJIS
    n = min(len(source), rng.randint(*count_range))
    n = max(n, 1)
    return rng.sample(source, n) if len(source) > 1 else list(source[:n])


def build_post(post_type: str, topic: str, theses: list[str], tone: str,
                brand_emojis: list[str] | None = None, rng: random.Random | None = None) -> dict:
    """4.1 — собирает пост по скелету (хук → тело → CTA), тезисы
    распределяются по секциям, CTA берётся из 4.5, в конце — 2-3
    фирменных эмодзи из Brand Kit."""
    if post_type not in _POST_SKELETONS:
        raise ValueError(f"Неизвестный тип поста: {post_type}")
    tone = tone if tone in CONTENT_TONES else _DEFAULT_TONE
    rng = rng or random

    skeleton = _POST_SKELETONS[post_type]
    content_section_keys = [s for s in skeleton if s not in ("hook", "cta")]
    distributed = _distribute_theses(theses, content_section_keys)

    sections: list[dict] = []
    for key in skeleton:
        if key == "hook":
            text = engine.generate(f"post_hook_{post_type}", {"topic": topic}, rng=rng)
        elif key == "cta":
            goal = _POST_TYPE_CTA_GOAL[post_type]
            text = generate_cta_variants(goal, tone, count=1, rng=rng)[0]
        else:
            bullets = distributed.get(key, [])
            if bullets:
                text = "\n".join(f"— {b}" for b in bullets if b)
            else:
                text = engine.generate(_FALLBACK_TEMPLATE_BY_SECTION[key], {"topic": topic}, rng=rng)
        sections.append({"key": key, "label": _SECTION_LABELS_RU[key], "text": text})

    emojis = pick_brand_emojis(brand_emojis, rng=rng)

    body_paragraphs = [s["text"] for s in sections if s["key"] not in ("cta",)]
    cta_text = next(s["text"] for s in sections if s["key"] == "cta")
    cta_line = f"{cta_text} {' '.join(emojis)}".strip()

    full_text = "\n\n".join([*body_paragraphs, cta_line])

    return {
        "post_type": post_type,
        "post_type_label": _POST_TYPE_LABELS[post_type],
        "sections": sections,
        "emojis": emojis,
        "text": full_text,
    }


# =====================================================================
# 4.2 Конструктор приветственного сообщения
# =====================================================================

engine.register("welcome_friendly", [
    "Привет, {name}! Рады видеть тебя в *{channel_name}* 🎉",
    "Йоу, {name}! Добро пожаловать в *{channel_name}* — здесь будет классно 😊",
    "{name}, привет! Заглянул(а) в *{channel_name}* — и не зря 🙌",
])
engine.register("welcome_expert", [
    "{name}, добро пожаловать в *{channel_name}*. Здесь — практика и проверенные знания.",
    "Приветствуем, {name}. *{channel_name}* — сообщество с фокусом на экспертизу.",
    "{name}, вы в *{channel_name}*: структурированная и полезная информация без воды.",
])
engine.register("welcome_sales", [
    "{name}, добро пожаловать в *{channel_name}*! Здесь — лучшие предложения и выгодные условия.",
    "Привет, {name}! В *{channel_name}* тебя ждут акции и полезные разборы.",
    "{name}, вы в *{channel_name}* — там, где выгода на первом месте.",
])
engine.register("welcome_official", [
    "{name}, добро пожаловать в *{channel_name}*.",
    "Приветствуем вас, {name}, в *{channel_name}*.",
    "{name}, благодарим за присоединение к *{channel_name}*.",
])


def build_welcome_message(channel_name: str, perks: list[str] | None, rules_short: str | None,
                           tone: str, rng: random.Random | None = None) -> dict:
    """4.2 — {name} намеренно остаётся буквальным плейсхолдером в тексте
    (см. app/content_engine.py _KeepUnknown) для будущей подстановки
    ботом при автоответе на /start. Название канала оборачивается в
    *bold* — это реальный синтаксис Telegram legacy Markdown (один
    астериск), а не канонический "**" редактора Markdown Builder
    (lib/markdown.ts) — то есть текст можно сразу использовать с
    parse_mode="Markdown" в боте, без дополнительного экспорта."""
    tone = tone if tone in CONTENT_TONES else _DEFAULT_TONE
    greeting = engine.generate(f"welcome_{tone}", {"channel_name": channel_name.strip()}, rng=rng)

    parts = [greeting]
    perks_clean = [p.strip() for p in (perks or []) if p.strip()]
    if perks_clean:
        parts.append("Что вас здесь ждёт:\n" + "\n".join(f"— {p}" for p in perks_clean))
    if rules_short and rules_short.strip():
        parts.append(f"Коротко о правилах: {rules_short.strip()}")

    return {"text": "\n\n".join(parts)}


# =====================================================================
# 4.3 Конструктор правил группы
# =====================================================================

COMMUNITY_TYPES = {"chat_by_interest", "educational", "commercial", "support"}

# Публичный (без "_") — читается из app/api/content.py для отдачи каталога
# типов сообществ фронтенду (GET /api/tools/group-rules/catalog).
COMMUNITY_TYPE_LABELS = {
    "chat_by_interest": "Чат по интересам",
    "educational": "Образовательное сообщество",
    "commercial": "Коммерческое сообщество",
    "support": "Сообщество поддержки",
}

# Ключ -> формулировка; порядок словаря = канонический порядок в списке,
# независимо от порядка, в котором фронтенд прислал выбранные ключи.
STANDARD_RULES_BANK: dict[str, str] = {
    "no_spam": "Никакого спама и флуда",
    "no_ads": "Реклама — только по согласованию с администрацией",
    "no_offtopic": "Соблюдайте тематику чата, офф-топ — в отдельный тред",
    "respect": "Уважительное общение, без оскорблений и токсичности",
    "no_nsfw": "Никакого NSFW-контента",
    "no_politics": "Без политики и религиозных споров",
    "no_multi_account": "Один аккаунт — один участник",
}


def build_group_rules(community_type: str, standard_rule_keys: list[str],
                       custom_rules: list[str] | None) -> dict:
    """4.3 — нумерованный список из выбранных типовых пунктов (в
    каноническом порядке STANDARD_RULES_BANK) + кастомных пунктов, с
    единым стилем формулировок (все с большой буквы, без точки в конце —
    единообразие достигается тем, что типовые формулировки уже написаны в
    одном стиле, а кастомные подставляются как есть)."""
    if community_type not in COMMUNITY_TYPES:
        raise ValueError(f"Неизвестный тип сообщества: {community_type}")

    selected = set(standard_rule_keys or [])
    rule_texts = [text for key, text in STANDARD_RULES_BANK.items() if key in selected]
    rule_texts += [r.strip() for r in (custom_rules or []) if r.strip()]

    numbered = [f"{i}. {text}" for i, text in enumerate(rule_texts, start=1)]
    heading = f"*Правила сообщества «{COMMUNITY_TYPE_LABELS[community_type]}»*"
    text = heading + ("\n\n" + "\n".join(numbered) if numbered else "\n\n(пункты не выбраны)")

    return {
        "community_type": community_type,
        "community_type_label": COMMUNITY_TYPE_LABELS[community_type],
        "rules": rule_texts,
        "text": text,
    }


# =====================================================================
# 4.4 Генератор заголовков
# =====================================================================

engine.register("headline_question", [
    "А вы уже пробовали {topic}?",
    "Что мешает вам разобраться с {topic}?",
    "Готовы наконец разобраться с {topic}?",
    "{topic} — а вы всё ещё сомневаетесь?",
])
engine.register("headline_number_benefit", [
    "5 способов улучшить {topic}",
    "3 причины обратить внимание на {topic}",
    "7 фактов про {topic}, которые вы не знали",
    "10 идей, как использовать {topic}",
])
engine.register("headline_intrigue", [
    "То, что вам не рассказывали про {topic}",
    "Секрет, который меняет всё в {topic}",
    "Мало кто знает это про {topic}",
    "Правда о {topic}, о которой молчат",
])
engine.register("headline_how_to", [
    "Как разобраться в {topic} за 10 минут",
    "Как начать с {topic} и не бросить",
    "Как выжать максимум из {topic}",
    "Как избежать типичных ошибок с {topic}",
])
engine.register("headline_comparison", [
    "{topic}: что выбрать и почему",
    "{topic} vs привычный подход — в чём разница",
    "{topic} или альтернатива — сравниваем",
    "До и после: как {topic} меняет всё",
])

_HEADLINE_TEMPLATE_KEYS = [
    "headline_question",
    "headline_number_benefit",
    "headline_intrigue",
    "headline_how_to",
    "headline_comparison",
]


def generate_headlines(topic: str, count: int, rng: random.Random | None = None) -> list[str]:
    """4.4 — набор шаблонов-паттернов заголовков (вопрос, число+выгода,
    интрига, «как…», сравнение), тема подставляется в каждый паттерн.
    Идёт по кругу по категориям, чтобы первые несколько заголовков были
    максимально разнотипными, а не 3 подряд из одной категории."""
    rng = rng or random
    variables = {"topic": topic}
    pools = {key: engine.generate_many(key, variables, count=99, rng=rng) for key in _HEADLINE_TEMPLATE_KEYS}
    # generate_many уже вернул случайно перемешанные полные банки — просто
    # обходим категории по кругу, забирая по одному элементу за раз.
    result: list[str] = []
    while len(result) < count and any(pools.values()):
        for key in _HEADLINE_TEMPLATE_KEYS:
            if len(result) >= count:
                break
            if pools[key]:
                result.append(pools[key].pop(0))
    return result


# =====================================================================
# 4.6 Генератор хештегов
# =====================================================================

HASHTAG_CATEGORIES = {"business", "lifestyle", "technology", "health", "education"}

_HASHTAG_CATEGORY_LABELS = {
    "business": "Бизнес",
    "lifestyle": "Лайфстайл",
    "technology": "Технологии",
    "health": "Здоровье",
    "education": "Образование",
}

_CATEGORY_HASHTAGS: dict[str, list[str]] = {
    "business": ["#бизнес", "#предпринимательство", "#стартап", "#маркетинг", "#продажи", "#b2b", "#финансы"],
    "lifestyle": ["#лайфстайл", "#жизнь", "#вдохновение", "#мотивация", "#саморазвитие", "#привычки"],
    "technology": ["#технологии", "#it", "#разработка", "#стартап", "#ии", "#программирование"],
    "health": ["#здоровье", "#фитнес", "#зож", "#питание", "#спорт", "#медицина"],
    "education": ["#образование", "#обучение", "#курсы", "#саморазвитие", "#знания", "#учеба"],
}

_COMMON_HASHTAGS = ["#топ", "#интересное", "#полезное", "#новости", "#совет", "#гайд"]

_TAG_CLEAN_RE = re.compile(r"[^0-9a-zA-Zа-яёА-ЯЁ]+")


def _slugify_tag(word: str) -> str:
    cleaned = _TAG_CLEAN_RE.sub("", word)
    return f"#{cleaned.lower()}" if cleaned else ""


def _niche_hashtags(niche: str) -> list[str]:
    """Ниша -> 1-2 хештега: один составной (все слова слитно) + первое
    отдельное слово, если оно достаточно длинное, чтобы быть полезным
    тегом само по себе."""
    words = [w for w in re.split(r"\s+", niche.strip()) if w]
    if not words:
        return []
    tags = [_slugify_tag("".join(words))]
    if len(words) > 1:
        first = _slugify_tag(words[0])
        if len(first) > 2:
            tags.append(first)
    return [t for t in tags if t and t != "#"]


def generate_hashtags(niche: str, category: str, count: int, rng: random.Random | None = None) -> list[str]:
    """4.6 — MVP без AI: комбинирование темы с локальным словарём общих +
    нишевых хештегов по выбранной категории. Убирает дубли, единый
    регистр (нижний)."""
    if category not in HASHTAG_CATEGORIES:
        raise ValueError(f"Неизвестная категория: {category}")
    rng = rng or random

    niche_tags = _niche_hashtags(niche)
    category_pool = list(_CATEGORY_HASHTAGS[category])
    common_pool = list(_COMMON_HASHTAGS)
    rng.shuffle(category_pool)
    rng.shuffle(common_pool)

    combined = _dedupe_ci(niche_tags + category_pool + common_pool)
    return combined[:count]
