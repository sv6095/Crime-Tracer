import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import ml from './locales/ml.json';

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', font: 'Space Grotesk' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', font: 'Anek Telugu' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', font: 'Anek Kannada' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', font: 'Anek Devanagari' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', font: 'Anek Tamil' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', font: 'Anek Malayalam' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

const resources = {
  en: { translation: en },
  te: { translation: te },
  kn: { translation: kn },
  hi: { translation: hi },
  ta: { translation: ta },
  ml: { translation: ml },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'crimetracer_cop_language',
    },
  });

// Function to get the appropriate font for current language
export const getLanguageFont = (langCode: string): string => {
  const lang = languages.find(l => l.code === langCode);
  return lang?.font || 'Space Grotesk';
};

// Function to update document font when language changes
export const updateDocumentFont = (langCode: string) => {
  const font = getLanguageFont(langCode);
  document.documentElement.style.setProperty('--font-regional', `'${font}', sans-serif`);
  document.documentElement.setAttribute('lang', langCode);
};

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  updateDocumentFont(lng);
});

// Initialize font on load
updateDocumentFont(i18n.language);

export default i18n;
