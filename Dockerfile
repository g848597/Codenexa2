FROM python:3.12-slim AS base

# psycopg2-binary не требует libpq-dev, но Pillow (загрузка фото инвесторов)
# нужны системные библиотеки для JPEG — без них pip install соберётся, но
# упадёт в рантайме на первой же загрузке фото.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY webapp ./webapp

# Непривилегированный пользователь — не запускаем процесс от root.
RUN useradd --create-home --shell /bin/bash codenexa \
    && mkdir -p /srv/data/uploads \
    && chown -R codenexa:codenexa /srv
USER codenexa

ENV PORT=8000
EXPOSE 8000

# Health-check дублирует /health-эндпоинт на уровне Docker — полезно локально
# (docker ps покажет healthy/unhealthy) и на хостингах, читающих HEALTHCHECK.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,os,sys; sys.exit(0) if urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=3).status==200 else sys.exit(1)"

CMD ["sh", "-c", "uvicorn app.web.server:app --host 0.0.0.0 --port ${PORT}"]
