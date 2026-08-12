"""Шаблонный движок раздела «Контент» (Этап 4, см. 04-content.md).

Единый интерфיס `generate(template_key, variables)` — сейчас реализован на
статичных паттернах (без AI, по спеке MVP). Паттерны регистрируются через
`register()` в content_logic.py (там же вся смысловая структура — банки
фраз, скелеты постов и т.д.), сам движок нарочно "глупый": не знает ничего
про Telegram/посты/CTA, только подстановка переменных в случайно выбранный
паттерн. Когда появится AI Writer, `generate()`/`generate_many()` можно
подменить на вызов LLM-API с теми же `variables` — вызывающий код
(app/api/content.py, content_logic.py) трогать не придётся, т.к. контракт
(строка -> строка/список строк) не меняется.

`{name}`-подобные плейсхолдеры, не входящие в variables, обрабатываются
безопасно: используем `.format_map` с классом, который оставляет
неизвестные ключи как есть (нужно для 4.2 — плейсхолдер {name}
предназначен для будущей подстановки ботом, а не для генератора).
"""
import random


class _KeepUnknown(dict):
    """Для str.format_map — неизвестный ключ остаётся как {key} в тексте,
    вместо KeyError. Нужно, чтобы плейсхолдеры вида {name} (4.2 Welcome
    Message) не ломали генерацию и доезжали до пользователя буквально."""

    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


_TEMPLATES: dict[str, list[str]] = {}


def register(template_key: str, patterns: list[str]) -> None:
    """Регистрирует банк паттернов под ключом. Повторная регистрация того
    же ключа перезаписывает банк — удобно при переопределении в тестах."""
    if not patterns:
        raise ValueError(f"Пустой банк паттернов для '{template_key}'")
    _TEMPLATES[template_key] = patterns


def _fill(pattern: str, variables: dict) -> str:
    return pattern.format_map(_KeepUnknown(**variables))


def generate(template_key: str, variables: dict, rng: random.Random | None = None) -> str:
    """Возвращает один случайный вариант из банка паттернов template_key,
    с подставленными variables."""
    patterns = _TEMPLATES.get(template_key)
    if not patterns:
        raise KeyError(f"Неизвестный template_key: '{template_key}'")
    chooser = rng.choice if rng else random.choice
    return _fill(chooser(patterns), variables)


def generate_many(template_key: str, variables: dict, count: int,
                   rng: random.Random | None = None) -> list[str]:
    """Возвращает до `count` РАЗНЫХ (не повторяющихся) вариантов из банка.
    Если паттернов в банке меньше, чем count — возвращает все, что есть
    (используется генераторами CTA/заголовков/hashtags, где повтор одного
    и того же варианта в выдаче не нужен)."""
    patterns = _TEMPLATES.get(template_key)
    if not patterns:
        raise KeyError(f"Неизвестный template_key: '{template_key}'")
    pool = list(patterns)
    (rng or random).shuffle(pool)
    chosen = pool[:count]
    return [_fill(p, variables) for p in chosen]


def has_template(template_key: str) -> bool:
    return template_key in _TEMPLATES
