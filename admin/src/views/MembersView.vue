<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { members as membersApi, projects, type Member, type Invitation, type Project } from '../api/client'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const projectId = route.params.projectId as string

const project = ref<Project | null>(null)
const memberList = ref<Member[]>([])
const invitationList = ref<Invitation[]>([])
const loading = ref(true)
const error = ref('')

const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('editor')
const inviting = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

onMounted(async () => {
  try {
    const [p, data] = await Promise.all([
      projects.list().then(ps => ps.find(x => x.id === projectId) ?? null),
      membersApi.list(projectId),
    ])
    project.value = p
    memberList.value = data.members
    invitationList.value = data.invitations
  } finally {
    loading.value = false
  }
})

async function sendInvite() {
  if (!inviteEmail.value.trim()) return
  inviting.value = true
  inviteError.value = ''
  inviteSuccess.value = ''
  try {
    const inv = await membersApi.invite(projectId, inviteEmail.value.trim(), inviteRole.value)
    invitationList.value.unshift(inv)
    inviteSuccess.value = t('members.invitationSentTo', { email: inv.email })
    inviteEmail.value = ''
  } catch (e: any) {
    inviteError.value = e.message
  } finally {
    inviting.value = false
  }
}

async function changeRole(member: Member, role: string) {
  try {
    const updated = await membersApi.updateRole(projectId, member.id, role)
    const idx = memberList.value.findIndex(m => m.id === member.id)
    if (idx !== -1) memberList.value[idx] = updated
  } catch (e: any) {
    error.value = e.message
  }
}

async function removeMember(member: Member) {
  if (!confirm(t('members.confirmRemove', { email: member.user.email }))) return
  try {
    await membersApi.remove(projectId, member.id)
    memberList.value = memberList.value.filter(m => m.id !== member.id)
  } catch (e: any) {
    error.value = e.message
  }
}

async function cancelInvitation(inv: Invitation) {
  if (!confirm(t('members.confirmCancelInvitation', { email: inv.email }))) return
  try {
    await membersApi.cancelInvitation(projectId, inv.id)
    invitationList.value = invitationList.value.filter(i => i.id !== inv.id)
  } catch (e: any) {
    error.value = e.message
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}
</script>

<template>
  <div class="page">
    <div class="breadcrumb">
      <RouterLink to="/">{{ $t('nav.projects') }}</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">{{ project?.name ?? '\u2026' }}</RouterLink>
      <span>/</span>
      <span class="current">{{ $t('members.title') }}</span>
    </div>

    <div class="page-header">
      <h1>{{ $t('members.title') }}</h1>
      <button class="btn btn-ghost" @click="router.push(`/projects/${projectId}`)">
        {{ $t('members.backToCollections') }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error" style="margin-bottom:1rem">{{ error }}</div>
    <div v-if="loading" class="text-muted">{{ $t('common.loading') }}</div>

    <template v-else>
      <!-- Invite form -->
      <div class="card" style="margin-bottom:1.5rem">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);font-weight:600">
          {{ $t('members.inviteSomeone') }}
        </div>
        <div style="padding:1.25rem 1.5rem">
          <div v-if="inviteError" class="alert alert-error" style="margin-bottom:1rem">{{ inviteError }}</div>
          <div v-if="inviteSuccess" class="alert alert-success" style="margin-bottom:1rem">{{ inviteSuccess }}</div>
          <form class="flex-gap" style="align-items:flex-end" @submit.prevent="sendInvite">
            <div class="field" style="flex:1;margin:0">
              <label>{{ $t('members.emailAddress') }}</label>
              <input
                v-model="inviteEmail"
                type="email"
                :placeholder="$t('members.emailPlaceholder')"
                :disabled="inviting"
              />
            </div>
            <div class="field" style="width:160px;margin:0">
              <label>{{ $t('members.role') }}</label>
              <select v-model="inviteRole" :disabled="inviting">
                <option value="editor">{{ $t('members.roleEditor') }}</option>
                <option value="viewer">{{ $t('members.roleViewer') }}</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="inviting || !inviteEmail">
              {{ inviting ? $t('members.sending') : $t('members.sendInvite') }}
            </button>
          </form>
        </div>
      </div>

      <!-- Current members -->
      <div class="card" style="margin-bottom:1.5rem">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);font-weight:600">
          {{ $t('members.membersSection') }}
        </div>
        <div
          v-for="m in memberList"
          :key="m.id"
          class="card-row"
          style="align-items:center"
        >
          <div>
            <div style="font-weight:500">{{ m.user.email }}</div>
            <div class="text-muted" style="font-size:0.8125rem">{{ $t('members.joined', { date: formatDate(m.createdAt) }) }}</div>
          </div>
          <div class="flex-gap" style="align-items:center">
            <select
              :value="m.role"
              style="padding:0.25rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:0.875rem"
              @change="changeRole(m, ($event.target as HTMLSelectElement).value)"
            >
              <option value="editor">{{ $t('members.roleEditor') }}</option>
              <option value="viewer">{{ $t('members.roleViewer') }}</option>
            </select>
            <button class="btn btn-danger btn-sm" @click="removeMember(m)">{{ $t('common.remove') }}</button>
          </div>
        </div>
        <div v-if="memberList.length === 0" class="card-empty">
          {{ $t('members.noMembers') }}
        </div>
      </div>

      <!-- Pending invitations -->
      <div v-if="invitationList.length > 0" class="card">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);font-weight:600">
          {{ $t('members.pendingInvitations') }}
        </div>
        <div
          v-for="inv in invitationList"
          :key="inv.id"
          class="card-row"
          style="align-items:center"
        >
          <div>
            <div style="font-weight:500">{{ inv.email }}</div>
            <div class="text-muted" style="font-size:0.8125rem">
              {{ $t('members.roleBadge', { role: inv.role }) }} &middot; {{ $t('members.expires', { date: formatDate(inv.expiresAt) }) }}
            </div>
          </div>
          <div class="flex-gap">
            <span class="badge badge-gray">{{ $t('members.pending') }}</span>
            <button class="btn btn-ghost btn-sm" @click="cancelInvitation(inv)">{{ $t('members.cancelBtn') }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
