import { PRODUCTS } from '../config/products.js';
import { NODE_COLOR_PALETTE, FLYWHEEL_CENTER, FLYWHEEL_MECHANICS } from '../config/flywheel.js';
import { tl } from '../i18n.js';

// Диаграмма больше не рисует 4 захардкоженных кружка с фиксированными связями.
// Она читает PRODUCTS и раскладывает столько узлов, сколько реально есть в
// каталоге — сегодня это N ботов, завтра N+1, без единой правки этого файла.

const CENTER = 160;
const ORBIT_R = 108;

function nodeRadiusFor(n) {
  if (n <= 4) return 26;
  if (n <= 6) return 22;
  if (n <= 9) return 18;
  return 15;
}

function fontSizeFor(n) {
  if (n <= 4) return 10.5;
  if (n <= 6) return 9.5;
  if (n <= 9) return 8.5;
  return 7.5;
}

// Короткие названия в узел в 1-2 строки, без обрезки смысла.
function wrapLabel(name, maxCharsPerLine) {
  if (name.length <= maxCharsPerLine) return [name];
  const words = name.split(' ');
  if (words.length === 1) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function renderFlywheel(container) {
  const n = PRODUCTS.length;
  const nodeR = nodeRadiusFor(n);
  const fontSize = fontSizeFor(n);
  const maxChars = n <= 4 ? 8 : 6;

  const spokes = [];
  const nodes = [];

  PRODUCTS.forEach((p, i) => {
    const angle = (360 / n) * i;
    const { x, y } = polar(CENTER, CENTER, ORBIT_R, angle);
    const color = NODE_COLOR_PALETTE[i % NODE_COLOR_PALETTE.length];
    const lines = wrapLabel(p.name, maxChars);
    const lineY = lines.length === 1 ? y + fontSize * 0.35 : y;

    spokes.push(`<line class="fw-spoke" style="animation-delay:${i * 70}ms" x1="${CENTER}" y1="${CENTER}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.55"/>`);

    nodes.push(`
      <g class="fw-node" style="animation-delay:${180 + i * 90}ms" tabindex="0">
        <title>${p.name}</title>
        <circle class="fw-node-ring" cx="${x}" cy="${y}" r="${nodeR + 6}" fill="none" stroke="${color}" stroke-width="1"/>
        <circle cx="${x}" cy="${y}" r="${nodeR}" fill="#15171c" stroke="${color}" stroke-width="1.4"/>
        ${lines.map((line, li) => `<text x="${x}" y="${lineY + li * (fontSize + 1.5)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="600" fill="#eceef1">${line}</text>`).join('')}
      </g>`);
  });

  const svg = `
  <svg class="flywheel-svg" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
    <circle class="fw-orbit" cx="${CENTER}" cy="${CENTER}" r="${ORBIT_R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

    <g fill="none">${spokes.join('')}</g>

    <circle class="fw-node fw-hub" style="animation-delay:0ms" cx="${CENTER}" cy="${CENTER}" r="40" fill="#121418" stroke="rgba(255,255,255,0.12)"/>
    <text x="${CENTER}" y="${CENTER - 4}" text-anchor="middle" fill="#eceef1" font-family="Fraunces, serif" font-size="12" font-weight="600">${tl(FLYWHEEL_CENTER.title)}</text>
    <text x="${CENTER}" y="${CENTER + 11}" text-anchor="middle" fill="#8b9099" font-family="JetBrains Mono, monospace" font-size="7">CODENEXA</text>

    ${nodes.join('')}
  </svg>`;

  const countLine = `
  <div class="fw-count">
    <span class="fw-count-num">${n}</span>
    <span class="fw-count-label">${tl({ ru: 'ботов в каталоге сегодня — каталог открыт для новых', en: 'bots in the catalog today — open for new ones' })}</span>
  </div>`;

  const legend = `
  <div class="fw-legend">
    ${FLYWHEEL_MECHANICS.map(m => `
      <div class="fw-legend-item">
        <div class="fw-legend-dot" style="background:${m.color};"></div>${tl(m.text)}
      </div>`).join('')}
  </div>`;

  container.innerHTML = svg + countLine + legend;
}
