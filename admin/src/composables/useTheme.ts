import { ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'apiforge-theme'

function readStored(): ThemePreference {
  return (localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? 'system'
}

function applyTheme(pref: ThemePreference) {
  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', pref)
  }
}

// Singleton state — shared across all composable calls
const preference = ref<ThemePreference>(readStored())

// Apply immediately to avoid flash
applyTheme(preference.value)

watch(preference, (pref) => {
  applyTheme(pref)
  if (pref === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, pref)
  }
})

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}
const ICONS: Record<ThemePreference, string> = {
  system: '💻',
  light: '☀️',
  dark: '🌙',
}

export function useTheme() {
  function setTheme(pref: ThemePreference) {
    preference.value = pref
  }

  return { preference, setTheme, LABELS, ICONS }
}
