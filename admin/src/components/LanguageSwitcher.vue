<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type Locale } from '../i18n'
import { users } from '../api/client'
import { useAuthStore } from '../stores/auth'

const { locale } = useI18n()
const auth = useAuthStore()

async function switchLocale(code: Locale) {
  setLocale(code)
  if (auth.isAuthenticated) {
    users.updateMe({ language: code }).catch(() => {})
  }
}
</script>

<template>
  <div style="display:flex;gap:2px">
    <button
      v-for="loc in SUPPORTED_LOCALES"
      :key="loc.code"
      class="btn btn-ghost btn-sm"
      :style="locale === loc.code ? 'background:var(--surface-2);font-weight:600' : ''"
      @click="switchLocale(loc.code)"
    >{{ loc.code.toUpperCase() }}</button>
  </div>
</template>
