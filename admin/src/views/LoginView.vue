<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const inviteEmail = sessionStorage.getItem('pendingInviteEmail') ?? ''
const email = ref(inviteEmail)
const code = ref('')
const step = ref<'email' | 'code'>('email')
const loading = ref(false)
const error = ref('')

async function requestOtp() {
  if (!email.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.requestOtp(email.value)
    step.value = 'code'
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function verifyOtp() {
  if (!code.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.verifyOtp(email.value, code.value)
    const pendingToken = sessionStorage.getItem('pendingInviteToken')
    if (pendingToken) {
      sessionStorage.removeItem('pendingInviteToken')
      sessionStorage.removeItem('pendingInviteEmail')
      router.push(`/invitations/accept?token=${pendingToken}`)
    } else {
      router.push('/')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">⚡ APIForge</div>

      <div v-if="inviteEmail" class="alert" style="background:var(--surface-2);border:1px solid var(--border);margin-bottom:1rem;font-size:0.875rem">
        Log in as <strong>{{ inviteEmail }}</strong> to accept your invitation.
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <form v-if="step === 'email'" class="form" @submit.prevent="requestOtp">
        <div class="field">
          <label>Email address</label>
          <input v-model="email" type="email" placeholder="you@example.com" autofocus required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send login code' }}
        </button>
      </form>

      <form v-else class="form" @submit.prevent="verifyOtp">
        <p class="text-muted" style="font-size:0.875rem">
          We sent a 6-digit code to <strong>{{ email }}</strong>
        </p>
        <div class="field">
          <label>One-time code</label>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            placeholder="123456"
            maxlength="6"
            autofocus
            required
          />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Verifying…' : 'Verify & login' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="step = 'email'">
          Use a different email
        </button>
      </form>
    </div>
  </div>
</template>
