import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Приложение раздаётся не с корня домена, а из-под пути /business-app/
  // (см. app/web/server.py в основном репозитории CodeNexa — статика
  // webapp/ монтируется на "/", и business-app/ живёт как подпапка внутри
  // неё после сборки). Без base все ссылки на JS/CSS собрались бы от корня
  // и не нашлись бы по такому URL.
  base: '/business-app/',
  server: {
    proxy: {
      // Forwards to the reference AI Director proxy in /server during
      // local dev (run `npm start` inside /server first). In production,
      // deploy /server behind the same domain/reverse-proxy so this path
      // resolves without any Vite-specific config.
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
