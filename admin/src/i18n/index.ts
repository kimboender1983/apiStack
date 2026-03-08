import { createI18n } from 'vue-i18n'
import en from './locales/en'
import nl from './locales/nl'
import de from './locales/de'

export type Locale = 'en' | 'nl' | 'de'

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'de', label: 'Deutsch' },
]

function getInitialLocale(): Locale {
  const stored = localStorage.getItem('language') as Locale | null
  if (stored && ['en', 'nl', 'de'].includes(stored)) return stored
  const browser = navigator.language.split('-')[0] as Locale
  if (['en', 'nl', 'de'].includes(browser)) return browser
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, nl, de },
})

export function setLocale(locale: Locale) {
  ;(i18n.global.locale as any).value = locale
  localStorage.setItem('language', locale)
  document.documentElement.setAttribute('lang', locale)
}
