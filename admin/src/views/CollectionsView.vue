<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collections, projects, type Collection, type Project } from '../api/client'
import { useProjectRole } from '../composables/useProjectRole'

const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId as string

const project = ref<Project | null>(null)
const list = ref<Collection[]>([])
const loading = ref(true)
const showModal = ref(false)
const newName = ref('')
const newVisibility = ref('protected')
const creating = ref(false)
const error = ref('')

const { role, isOwner, canEdit } = useProjectRole(projectId)

onMounted(async () => {
  const [p, c] = await Promise.all([
    projects.list().then(ps => ps.find(x => x.id === projectId) ?? null),
    collections.list(projectId),
  ])
  project.value = p
  list.value = c
  loading.value = false
})

async function create() {
  if (!newName.value.trim()) return
  creating.value = true
  error.value = ''
  try {
    const c = await collections.create(projectId, newName.value.trim(), newVisibility.value)
    list.value.unshift(c)
    newName.value = ''
    newVisibility.value = 'protected'
    showModal.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}

async function remove(c: Collection) {
  if (!confirm(`Delete collection "${c.name}"?`)) return
  await collections.delete(projectId, c.id)
  list.value = list.value.filter(x => x.id !== c.id)
}

const visibilityClass: Record<string, string> = {
  public: 'badge-green',
  protected: 'badge-purple',
  private: 'badge-gray',
}

const roleCls: Record<string, string> = {
  owner: 'role-owner',
  editor: 'role-editor',
  viewer: 'role-viewer',
}
</script>

<template>
  <div class="page">
    <div class="breadcrumb">
      <RouterLink to="/">Projects</RouterLink>
      <span>/</span>
      <span class="current">{{ project?.name ?? '…' }}</span>
    </div>

    <div class="page-header">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <h1>Collections</h1>
        <span v-if="role" class="role-badge" :class="roleCls[role]">{{ role }}</span>
      </div>
      <button v-if="canEdit()" class="btn btn-primary" @click="showModal = true">+ New collection</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <div v-else class="card">
      <div
        v-for="c in list"
        :key="c.id"
        class="card-row"
        @click="router.push(`/projects/${projectId}/collections/${c.id}`)"
      >
        <div>
          <div style="font-weight:500">{{ c.name }}</div>
          <div class="text-muted" style="font-size:0.8125rem">
            {{ c.fields?.length ?? 0 }} fields
          </div>
        </div>
        <div class="flex-gap" @click.stop>
          <span class="badge" :class="visibilityClass[c.visibility]">{{ c.visibility }}</span>
          <button v-if="isOwner()" class="btn btn-danger btn-sm" @click="remove(c)">Delete</button>
        </div>
      </div>
      <div v-if="list.length === 0" class="card-empty">
        No collections yet.{{ canEdit() ? ' Create your first one.' : '' }}
      </div>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>New collection</h2>
        <button class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form class="form" @submit.prevent="create">
        <div class="field">
          <label>Collection name</label>
          <input v-model="newName" placeholder="posts" autofocus required />
        </div>
        <div class="field">
          <label>Visibility</label>
          <select v-model="newVisibility">
            <option value="public">public — no auth required</option>
            <option value="protected">protected — API key required</option>
            <option value="private">private — owner key only</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create collection' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
