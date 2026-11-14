/**
 * Every language the player can pick. To add one:
 * 1. Copy src/locales/en to src/locales/<code> and translate the values.
 * 2. Add a line here. `npm test` reports any missing or extra keys.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'vi', label: 'Tiếng Việt', dir: 'ltr' },
  { code: 'zh-CN', label: '简体中文', dir: 'ltr' },
] as const;

export const DEFAULT_LANGUAGE = 'en';
export const NAMESPACES = ['ui', 'story', 'missions', 'hardware', 'quiz'] as const;
