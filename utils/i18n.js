import i18n from 'i18n-js';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import vi from './locales/vi.json';

i18n.translations = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  zh,
  ja,
  ko,
  vi
};

i18n.fallbacks = true;
i18n.defaultLocale = 'en';

export default i18n;
