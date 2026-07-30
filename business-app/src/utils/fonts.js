import { useEffect } from "react";

/**
 * Injects the Google Fonts (Space Grotesk, Inter, JetBrains Mono) used
 * throughout the app. Call once, e.g. inside <App />.
 */
export default function useFonts() {
  useEffect(() => {
    const id = "cnb-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}
