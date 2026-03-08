<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { users } from '../api/client'
import UserAvatar from '../components/UserAvatar.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const auth = useAuthStore()
useI18n()

const name = ref(auth.user?.name ?? '')
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

const uploading = ref(false)
const uploadError = ref('')

const avatarUrl = computed(() => auth.user?.avatarUrl ?? null)
const email = computed(() => auth.user?.email ?? '')

async function saveName() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const updated = await users.updateMe({ name: name.value.trim() || undefined })
    if (auth.user) {
      auth.user.name = updated.name
      auth.user.avatarUrl = updated.avatarUrl
    }
    saveSuccess.value = true
    setTimeout(() => (saveSuccess.value = false), 3000)
  } catch (e: any) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

async function onAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const updated = await users.uploadAvatar(file)
    if (auth.user) {
      auth.user.avatarUrl = updated.avatarUrl
      auth.user.name = updated.name
    }
  } catch (e: any) {
    uploadError.value = e.message
  } finally {
    uploading.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

function triggerUpload() {
  document.getElementById('avatar-input')?.click()
}
</script>

<template>
  <div class="page">
    <div class="breadcrumb">
      <span class="current">{{ $t('profile.title') }}</span>
    </div>

    <div class="page-header">
      <h1>{{ $t('profile.title') }}</h1>
    </div>

    <div style="max-width:480px;display:flex;flex-direction:column;gap:1.5rem">

      <!-- Avatar section -->
      <div class="card" style="padding:1.5rem">
        <h2 style="margin-bottom:1.25rem">{{ $t('profile.profilePicture') }}</h2>

        <div style="display:flex;align-items:center;gap:1.5rem">
          <div style="position:relative;cursor:pointer" @click="triggerUpload">
            <UserAvatar :avatarUrl="avatarUrl" :email="email" :size="80" />
            <div
              style="
                position:absolute;inset:0;border-radius:50%;
                background:rgba(0,0,0,0.45);
                display:flex;align-items:center;justify-content:center;
                opacity:0;transition:opacity 0.15s;
                font-size:0.75rem;color:#fff;font-weight:600;text-align:center;line-height:1.3
              "
              onmouseenter="this.style.opacity=1"
              onmouseleave="this.style.opacity=0"
            >{{ $t('profile.change') }}</div>
          </div>

          <div>
            <p class="text-muted" style="font-size:0.875rem;margin-bottom:0.75rem">
              {{ $t('profile.uploadHint') }}
            </p>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              style="display:none"
              @change="onAvatarChange"
            />
            <button class="btn btn-ghost" :disabled="uploading" @click="triggerUpload">
              {{ uploading ? $t('profile.uploading') : $t('profile.changePicture') }}
            </button>
          </div>
        </div>

        <div v-if="uploadError" class="alert alert-error" style="margin-top:1rem;margin-bottom:0">
          {{ uploadError }}
        </div>
      </div>

      <!-- Name section -->
      <div class="card" style="padding:1.5rem">
        <h2 style="margin-bottom:1.25rem">{{ $t('profile.displayName') }}</h2>

        <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
        <div v-if="saveSuccess" class="alert alert-success">{{ $t('profile.saved') }}</div>

        <form class="form" @submit.prevent="saveName">
          <div class="field">
            <label>{{ $t('profile.fullName') }}</label>
            <input v-model="name" :placeholder="$t('profile.namePlaceholder')" />
          </div>
          <div class="field">
            <label>{{ $t('profile.emailAddress') }}</label>
            <input :value="email" disabled style="opacity:0.6;cursor:not-allowed" />
            <span class="text-muted" style="font-size:0.8rem">{{ $t('profile.emailCannotChange') }}</span>
          </div>
          <div>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? $t('profile.saving') : $t('profile.saveChanges') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Language section -->
      <div class="card" style="padding:1.5rem">
        <h2 style="margin-bottom:0.5rem">{{ $t('profile.language') }}</h2>
        <p class="text-muted" style="font-size:0.875rem;margin-bottom:1rem">{{ $t('profile.languageHint') }}</p>
        <LanguageSwitcher />
      </div>

    </div>
  </div>
</template>
