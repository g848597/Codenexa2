import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { applyTelegramTheme } from "./lib/telegram";
import { Home } from "./pages/Home";
import { UsernameChecker } from "./pages/UsernameChecker";
import { BioGenerator } from "./pages/BioGenerator";
import { DeepLinkBuilder } from "./pages/DeepLinkBuilder";
import { MarkdownBuilder } from "./pages/MarkdownBuilder";
import { UnicodeFonts } from "./pages/UnicodeFonts";
import { TextCleaner } from "./pages/TextCleaner";
import { PasswordGenerator } from "./pages/PasswordGenerator";
import { JsonFormatter } from "./pages/JsonFormatter";
import { Base64Tool } from "./pages/Base64Tool";
import { TimestampConverter } from "./pages/TimestampConverter";
import { UtmBuilder } from "./pages/UtmBuilder";
import { UrlShortener } from "./pages/UrlShortener";
import { PostConstructor } from "./pages/PostConstructor";
import { WelcomeMessageBuilder } from "./pages/WelcomeMessageBuilder";
import { GroupRulesBuilder } from "./pages/GroupRulesBuilder";
import { HeadlineGenerator } from "./pages/HeadlineGenerator";
import { CtaGenerator } from "./pages/CtaGenerator";
import { HashtagGenerator } from "./pages/HashtagGenerator";
import { BannerCreator } from "./pages/BannerCreator";
import { AvatarCreator } from "./pages/AvatarCreator";
import { QrCreator } from "./pages/QrCreator";
import { ImageResizeCropCompress } from "./pages/ImageResizeCropCompress";
import { ColorPaletteGenerator } from "./pages/ColorPaletteGenerator";
import { WatermarkCreator } from "./pages/WatermarkCreator";
import { ContentPlanBoard } from "./pages/ContentPlanBoard";
import { ContentCalendar } from "./pages/ContentCalendar";
import { IdeaGenerator } from "./pages/IdeaGenerator";
import { PollQuizGenerator } from "./pages/PollQuizGenerator";
import { SmartHistory } from "./pages/SmartHistory";

// HashRouter — Mini App отдаётся статикой из-под произвольного пути в
// зависимости от хостинга; хэш-роутинг не требует серверной настройки
// rewrite-правил под каждый /tools/* маршрут.
export default function App() {
  useEffect(() => {
    applyTelegramTheme();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/username-checker" element={<UsernameChecker />} />
        <Route path="/tools/bio-generator" element={<BioGenerator />} />
        <Route path="/tools/deep-link-builder" element={<DeepLinkBuilder />} />
        <Route path="/tools/markdown-builder" element={<MarkdownBuilder />} />
        <Route path="/tools/unicode-fonts" element={<UnicodeFonts />} />
        <Route path="/tools/text-cleaner" element={<TextCleaner />} />
        <Route path="/tools/password-generator" element={<PasswordGenerator />} />
        <Route path="/tools/json-formatter" element={<JsonFormatter />} />
        <Route path="/tools/base64" element={<Base64Tool />} />
        <Route path="/tools/timestamp-converter" element={<TimestampConverter />} />
        <Route path="/tools/utm-builder" element={<UtmBuilder />} />
        <Route path="/tools/url-shortener" element={<UrlShortener />} />
        <Route path="/tools/post-constructor" element={<PostConstructor />} />
        <Route path="/tools/welcome-message" element={<WelcomeMessageBuilder />} />
        <Route path="/tools/group-rules" element={<GroupRulesBuilder />} />
        <Route path="/tools/headline-generator" element={<HeadlineGenerator />} />
        <Route path="/tools/cta-generator" element={<CtaGenerator />} />
        <Route path="/tools/hashtag-generator" element={<HashtagGenerator />} />
        <Route path="/tools/banner-creator" element={<BannerCreator />} />
        <Route path="/tools/avatar-creator" element={<AvatarCreator />} />
        <Route path="/tools/qr-creator" element={<QrCreator />} />
        <Route path="/tools/image-tools" element={<ImageResizeCropCompress />} />
        <Route path="/tools/color-palette" element={<ColorPaletteGenerator />} />
        <Route path="/tools/watermark-creator" element={<WatermarkCreator />} />
        <Route path="/tools/content-plan" element={<ContentPlanBoard />} />
        <Route path="/tools/content-calendar" element={<ContentCalendar />} />
        <Route path="/tools/idea-generator" element={<IdeaGenerator />} />
        <Route path="/tools/poll-quiz-generator" element={<PollQuizGenerator />} />
        <Route path="/history" element={<SmartHistory />} />
      </Routes>
    </HashRouter>
  );
}
