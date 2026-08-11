#!/usr/bin/env python3
"""
Простой статический сервер на чистом Python (только стандартная библиотека,
без Node и без внешних зависимостей). Раздаёт index.html, styles.css, app.js
и содержимое supabase/ (на случай, если кто-то откроет путь напрямую).
"""

import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", "8080"))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Простой сайт без клиентского роутинга — кешировать не обязательно,
        # но явный Content-Type для .js/.css выставляем на всякий случай.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Serving {DIRECTORY} on 0.0.0.0:{PORT}")
        httpd.serve_forever()
