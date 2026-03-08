<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { members as membersApi, type InvitationInfo } from '../api/client'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
useI18n()

const token = route.query.token as string
const invitation = ref<InvitationInfo | null>(null)
const loading = ref(true)
const accepting = ref(false)
const error = ref('')
const notFound = ref(false)

// Is the logged-in user a different person than who the invite was sent to?
const wrongAccount = computed(() => {
  if (!auth.user || !invitation.value) return false
  return auth.user.email.toLowerCase() !== invitation.value.email.toLowerCase()
})

onMounted(async () => {
  // Ensure user info is loaded if authenticated (public page skips App.vue onMounted)
  if (auth.isAuthenticated && !auth.user) {
    await auth.loadUser()
  }

  if (!token) {
    notFound.value = true
    loading.value = false
    return
  }
  try {
    invitation.value = await membersApi.getInvitation(token)
  } catch (e: any) {
    error.value = e.message
    notFound.value = true
  } finally {
    loading.value = false
  }
})

function logoutAndContinue() {
  sessionStorage.setItem('pendingInviteToken', token)
  if (invitation.value) sessionStorage.setItem('pendingInviteEmail', invitation.value.email)
  auth.logout()
  router.push('/login')
}

async function accept() {
  if (!auth.isAuthenticated) {
    sessionStorage.setItem('pendingInviteToken', token)
    router.push('/login')
    return
  }
  accepting.value = true
  error.value = ''
  try {
    const result = await membersApi.acceptInvitation(token)
    router.push(`/projects/${result.projectId}`)
  } catch (e: any) {
    error.value = e.message
    accepting.value = false
  }
}
</script>

<template>
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)">
    <div style="width:100%;max-width:420px;padding:2rem">
      <div class="card" style="padding:2rem;text-align:center">
        <div v-if="loading" class="text-muted">{{ $t('invitation.loading') }}</div>

        <template v-else-if="notFound">
          <div style="font-size:2rem;margin-bottom:1rem">🔗</div>
          <h2 style="margin-bottom:0.5rem">{{ $t('invitation.invalidTitle') }}</h2>
          <p class="text-muted">{{ $t('invitation.invalidDesc') }}</p>
          <RouterLink to="/" class="btn btn-primary" style="margin-top:1.5rem;display:inline-block">
            {{ $t('invitation.goToDashboard') }}
          </RouterLink>
        </template>

        <template v-else-if="invitation">
          <div style="font-size:2rem;margin-bottom:1rem">📬</div>
          <h2 style="margin-bottom:0.5rem">{{ $t('invitation.invited') }}</h2>
          <p class="text-muted" style="margin-bottom:1.5rem">
            {{ $t('invitation.joinAs', { project: invitation.project.name, role: invitation.role }) }}
          </p>

          <!-- Wrong account warning -->
          <div v-if="wrongAccount" class="alert alert-error" style="margin-bottom:1.25rem;text-align:left">
            <strong>{{ $t('invitation.wrongAccount') }}</strong>
            {{ $t('invitation.wrongAccountDesc', { inviteEmail: invitation.email, currentEmail: auth.user?.email }) }}
            <div style="margin-top:0.75rem">
              <button class="btn btn-ghost btn-sm" @click="logoutAndContinue">
                {{ $t('invitation.logoutSwitch') }}
              </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-error" style="margin-bottom:1rem;text-align:left">{{ error }}</div>

          <div
            v-if="!auth.isAuthenticated"
            class="alert"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;margin-bottom:1.5rem;text-align:left;font-size:0.875rem"
          >
            {{ $t('invitation.loginToAccept', { email: invitation.email }) }}
          </div>

          <button
            v-if="!wrongAccount"
            class="btn btn-primary"
            style="width:100%"
            :disabled="accepting"
            @click="accept"
          >
            {{ accepting ? $t('invitation.accepting') : auth.isAuthenticated ? $t('invitation.acceptInvitation') : $t('invitation.loginToAcceptBtn') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
