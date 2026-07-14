// Преобразует название страны (или ISO-код) в эмодзи-флаг. Используется в
// components/investors.js для карточек инвесторов, где страну вводит админ
// свободным текстом (см. app/web/api/investors.py::InvestorIn.country).
//
// Правило №1 (честность): если страна не распознана, возвращаем нейтральный
// глобус (icon('globe')), а не флаг наугад.

import { icon } from './icons.js';

const GLOBE_FALLBACK = icon('globe');

const NAME_TO_CODE = {
  'россия': 'RU', 'russia': 'RU', 'russian federation': 'RU',
  'казахстан': 'KZ', 'kazakhstan': 'KZ',
  'сша': 'US', 'usa': 'US', 'us': 'US', 'united states': 'US', 'united states of america': 'US',
  'великобритания': 'GB', 'англия': 'GB', 'uk': 'GB', 'united kingdom': 'GB',
  'германия': 'DE', 'germany': 'DE',
  'франция': 'FR', 'france': 'FR',
  'украина': 'UA', 'ukraine': 'UA',
  'беларусь': 'BY', 'белоруссия': 'BY', 'belarus': 'BY',
  'узбекистан': 'UZ', 'uzbekistan': 'UZ',
  'киргизия': 'KG', 'кыргызстан': 'KG', 'kyrgyzstan': 'KG',
  'таджикистан': 'TJ', 'tajikistan': 'TJ',
  'туркменистан': 'TM', 'turkmenistan': 'TM',
  'китай': 'CN', 'china': 'CN',
  'япония': 'JP', 'japan': 'JP',
  'южная корея': 'KR', 'корея': 'KR', 'south korea': 'KR', 'korea': 'KR',
  'оаэ': 'AE', 'uae': 'AE', 'united arab emirates': 'AE',
  'сингапур': 'SG', 'singapore': 'SG',
  'индия': 'IN', 'india': 'IN',
  'турция': 'TR', 'turkey': 'TR', 'türkiye': 'TR', 'turkiye': 'TR',
  'канада': 'CA', 'canada': 'CA',
  'испания': 'ES', 'spain': 'ES',
  'италия': 'IT', 'italy': 'IT',
  'нидерланды': 'NL', 'netherlands': 'NL', 'голландия': 'NL',
  'швейцария': 'CH', 'switzerland': 'CH',
  'польша': 'PL', 'poland': 'PL',
  'грузия': 'GE', 'georgia': 'GE',
  'армения': 'AM', 'armenia': 'AM',
  'азербайджан': 'AZ', 'azerbaijan': 'AZ',
  'молдова': 'MD', 'moldova': 'MD',
  'бразилия': 'BR', 'brazil': 'BR',
  'мексика': 'MX', 'mexico': 'MX',
  'австралия': 'AU', 'australia': 'AU',
  'швеция': 'SE', 'sweden': 'SE',
  'норвегия': 'NO', 'norway': 'NO',
  'финляндия': 'FI', 'finland': 'FI',
  'дания': 'DK', 'denmark': 'DK',
  'португалия': 'PT', 'portugal': 'PT',
  'чехия': 'CZ', 'czech republic': 'CZ', 'czechia': 'CZ',
  'австрия': 'AT', 'austria': 'AT',
  'ирландия': 'IE', 'ireland': 'IE',
  'израиль': 'IL', 'israel': 'IL',
  'саудовская аравия': 'SA', 'saudi arabia': 'SA',
  'катар': 'QA', 'qatar': 'QA',
  'таиланд': 'TH', 'thailand': 'TH',
  'вьетнам': 'VN', 'vietnam': 'VN',
  'индонезия': 'ID', 'indonesia': 'ID',
  'филиппины': 'PH', 'philippines': 'PH',
  'малайзия': 'MY', 'malaysia': 'MY',
  'египет': 'EG', 'egypt': 'EG',
  'юар': 'ZA', 'south africa': 'ZA',
  'аргентина': 'AR', 'argentina': 'AR',
  'чили': 'CL', 'chile': 'CL',
  'новая зеландия': 'NZ', 'new zealand': 'NZ',
};

function codeToFlag(code) {
  if (!code || code.length !== 2 || !/^[a-zA-Z]{2}$/.test(code)) return null;
  const base = 127397; // смещение до regional indicator symbols: 0x1F1E6 - 'A'.charCodeAt(0)
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + base));
}

export function countryFlag(country) {
  if (!country) return GLOBE_FALLBACK;
  const trimmed = String(country).trim();
  if (!trimmed) return GLOBE_FALLBACK;

  // Уже похоже на ISO-код (например, "US", "kz")
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return codeToFlag(trimmed) || GLOBE_FALLBACK;
  }

  const code = NAME_TO_CODE[trimmed.toLowerCase()];
  return code ? codeToFlag(code) || GLOBE_FALLBACK : GLOBE_FALLBACK;
}
