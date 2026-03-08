<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { team, members as membersApi, type WorkspaceTeam, type TeamMember } from '../api/client'
import UserAvatar from '../components/UserAvatar.vue'

const data = ref<WorkspaceTeam | null>(null)
const loading = ref(true)

// Invite form
const showInvite = ref(false)
const inviteEmail = ref('')
const inviting = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

// Per-project role+selected state for invite form
const inviteAssignments = reactive<Record<string, { selected: boolean; role: string }>>({})

onMounted(async () => {
  await load()
})

async function load() {
  loading.value = true
  data.value = await team.get()
  // Init invite assignments
  for (const p of data.value.projects) {
    if (!inviteAssignments[p.id]) {
      inviteAssignments[p.id] = { selected: false, role: 'editor' }
    }
  }
  loading.value = false
}

async function sendInvite() {
  inviteError.value = ''
  inviteSuccess.value = ''
  const assignments = Object.entries(inviteAssignments)
    .filter(([, v]) => v.selected)
    .map(([projectId, v]) => ({ projectId, role: v.role }))
  if (assignments.length === 0) {
    inviteError.value = 'Select at least one project.'
    return
  }
  inviting.value = true
  try {
    const result = await team.invite(inviteEmail.value.trim(), assignments)
    if (result.errors.length > 0 && result.invitations.length === 0) {
      inviteError.value = result.errors.map((e: any) => e.reason).join(', ')
    } else {
      inviteSuccess.value = `Invitation${result.invitations.length > 1 ? 's' : ''} sent to ${inviteEmail.value}.`
      if (result.errors.length > 0) {
        inviteSuccess.value += ` (${result.errors.length} project(s) skipped: already a member)`
      }
      inviteEmail.value = ''
      Object.values(inviteAssignments).forEach(v => { v.selected = false; v.role = 'editor' })
      showInvite.value = false
      await load()
    }
  } catch (e: any) {
    inviteError.value = e.message
  } finally {
    inviting.value = false
  }
}

async function changeRole(membership: { id: string; projectId: string; role: string }, newRole: string) {
  await membersApi.updateRole(membership.projectId, membership.id, newRole)
  membership.role = newRole
}

async function removeMembership(member: TeamMember, membership: { id: string; projectId: string; projectName: string }) {
  if (!confirm(`Remove ${member.user.email} from "${membership.projectName}"?`)) return
  await membersApi.remove(membership.projectId, membership.id)
  member.memberships = member.memberships.filter(m => m.id !== membership.id)
  if (member.memberships.length === 0) {
    data.value!.members = data.value!.members.filter(m => m.user.id !== member.user.id)
  }
}

async function cancelInvitation(invEmail: string, inv: { invitationId: string; projectId: string; projectName: string }) {
  if (!confirm(`Cancel invitation to "${inv.projectName}" for ${invEmail}?`)) return
  await membersApi.cancelInvitation(inv.projectId, inv.invitationId)
  await load()
}

function displayName(user: { name: string | null; email: string }) {
  return user.name || user.email
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Team</h1>
      <button class="btn btn-primary" @click="showInvite = true">+ Invite member</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <template v-else-if="data">
      <!-- No projects owned -->
      <div v-if="data.projects.length === 0" class="card">
        <div class="card-empty">Create a project first to invite team members.</div>
      </div>

      <template v-else>
        <!-- Active members -->
        <div v-if="data.members.length > 0" class="card" style="margin-bottom:1.5rem">
          <div v-for="member in data.members" :key="member.user.id">
            <div class="card-row" style="cursor:default;align-items:flex-start;gap:1rem">
              <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0">
                <UserAvatar
                  :avatarUrl="member.user.avatarUrl"
                  :name="member.user.name"
                  :email="member.user.email"
                  :size="36"
                />
                <div>
                  <div style="font-weight:500">{{ displayName(member.user) }}</div>
                  <div v-if="member.user.name" class="text-muted" style="font-size:0.8125rem">{{ member.user.email }}</div>
                </div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:0.375rem">
                <div
                  v-for="m in member.memberships"
                  :key="m.id"
                  style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem"
                >
                  <span class="text-muted" style="font-size:0.8125rem">{{ m.projectName }}</span>
                  <div class="flex-gap">
                    <select
                      :value="m.role"
                      class="role-select"
                      @change="changeRole(m, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button class="btn btn-danger btn-sm" @click="removeMembership(member, m)">Remove</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pending invitations -->
        <div v-if="data.invitations.length > 0" class="section">
          <div class="section-header">
            <h3>Pending invitations</h3>
          </div>
          <div class="card">
            <div v-for="inv in data.invitations" :key="inv.email">
              <div class="card-row" style="cursor:default;align-items:flex-start;gap:1rem">
                <div style="flex-shrink:0">
                  <div style="font-weight:500">{{ inv.email }}</div>
                  <div class="text-muted" style="font-size:0.8125rem">awaiting acceptance</div>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;gap:0.375rem">
                  <div
                    v-for="p in inv.projects"
                    :key="p.invitationId"
                    style="display:flex;align-items:center;justify-content:space-between"
                  >
                    <span class="text-muted" style="font-size:0.8125rem">{{ p.projectName }}</span>
                    <div class="flex-gap">
                      <span class="badge badge-gray">{{ p.role }}</span>
                      <button class="btn btn-danger btn-sm" @click="cancelInvitation(inv.email, p)">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="data.members.length === 0 && data.invitations.length === 0" class="card">
          <div class="card-empty">No team members yet. Invite someone to get started.</div>
        </div>
      </template>
    </template>
  </div>

  <!-- Invite modal -->
  <div v-if="showInvite" class="modal-overlay" @click.self="showInvite = false">
    <div class="modal" style="width:500px">
      <div class="modal-header">
        <h2>Invite team member</h2>
        <button class="btn btn-ghost btn-sm" @click="showInvite = false">✕</button>
      </div>

      <div v-if="inviteError" class="alert alert-error">{{ inviteError }}</div>

      <form class="form" @submit.prevent="sendInvite">
        <div class="field">
          <label>Email address</label>
          <input v-model="inviteEmail" type="email" placeholder="colleague@example.com" autofocus required />
        </div>

        <div class="field">
          <label>Project access</label>
          <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.25rem">
            <div
              v-for="p in data?.projects"
              :key="p.id"
              style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)"
            >
              <label style="display:flex;align-items:center;gap:0.625rem;cursor:pointer;flex:1">
                <input
                  type="checkbox"
                  :checked="inviteAssignments[p.id]?.selected"
                  style="width:auto;accent-color:var(--accent)"
                  @change="inviteAssignments[p.id].selected = ($event.target as HTMLInputElement).checked"
                />
                <span style="font-size:0.875rem;font-weight:500">{{ p.name }}</span>
              </label>
              <select
                v-if="inviteAssignments[p.id]?.selected"
                v-model="inviteAssignments[p.id].role"
                class="role-select"
              >
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showInvite = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="inviting">
            {{ inviting ? 'Sending…' : 'Send invitation' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.role-select {
  width: auto;
  padding: 0.2rem 0.5rem;
  font-size: 0.8125rem;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}
</style>
