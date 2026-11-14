import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGES, NAMESPACES } from './languages';
import ui from '../locales/en/ui.json';
import story from '../locales/en/story.json';
import missions from '../locales/en/missions.json';
import hardware from '../locales/en/hardware.json';
import quiz from '../locales/en/quiz.json';

const lazyLocales = import.meta.glob(['../locales/*/*.json', '!../locales/en/*.json']);
let latestLanguageRequest = 0;

i18n.use(initReactI18next).init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: [...NAMESPACES],
  defaultNS: 'ui',
  resources: { en: { ui, story, missions, hardware, quiz } },
  interpolation: { escapeValue: false },
  returnObjects: true,
});

/** Loads a language on demand, then switches to it. English is always bundled as the fallback. */
export async function setLanguage(code: string): Promise<void> {
  const language = LANGUAGES.find((l) => l.code === code);
  if (!language) return;
  const request = ++latestLanguageRequest;
  if (code !== DEFAULT_LANGUAGE && !i18n.hasResourceBundle(code, 'ui')) {
    await Promise.all(
      NAMESPACES.map(async (ns) => {
        const load = lazyLocales[`../locales/${code}/${ns}.json`];
        if (load) i18n.addResourceBundle(code, ns, ((await load()) as { default: object }).default);
      }),
    );
  }
  if (request !== latestLanguageRequest) return;
  await i18n.changeLanguage(code);
  document.documentElement.lang = code;
  document.documentElement.dir = language.dir;
}

export default i18n;
