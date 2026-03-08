<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { projects, type Project } from '../api/client'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const list = ref<Project[]>([])
const loading = ref(true)
const showModal = ref(false)
const newName = ref('')
const creating = ref(false)
const error = ref('')

onMounted(async () => {
  list.value = await projects.list()
  loading.value = false
})

const myProjects = computed(() => list.value.filter(p => p.userId === auth.user?.id))
const sharedProjects = computed(() => list.value.filter(p => p.userId !== auth.user?.id))

async function create() {
  if (!newName.value.trim()) return
  creating.value = true
  error.value = ''
  try {
    const p = await projects.create(newName.value.trim())
    list.value.unshift(p)
    newName.value = ''
    showModal.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}

async function remove(p: Project) {
  if (!confirm(`Delete project "${p.name}"? This will remove all collections and records.`)) return
  await projects.delete(p.id)
  list.value = list.value.filter(x => x.id !== p.id)
}

function ownerLabel(p: Project) {
  return p.user.name || p.user.email
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Projects</h1>
      <button class="btn btn-primary" @click="showModal = true">+ New project</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <template v-else>
      <!-- My projects -->
      <div v-if="myProjects.length > 0" class="section" style="margin-top:0">
        <div class="card">
          <div
            v-for="p in myProjects"
            :key="p.id"
            class="card-row"
            @click="router.push(`/projects/${p.id}`)"
          >
            <div>
              <div style="font-weight:500">{{ p.name }}</div>
              <div class="text-muted" style="font-size:0.8125rem">{{ p.slug }}</div>
            </div>
            <div class="flex-gap" @click.stop>
              <span class="badge badge-purple">owner</span>
              <button class="btn btn-danger btn-sm" @click="remove(p)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Shared with me -->
      <div v-if="sharedProjects.length > 0" class="section">
        <div class="section-header">
          <h3>Shared with me</h3>
        </div>
        <div class="card">
          <div
            v-for="p in sharedProjects"
            :key="p.id"
            class="card-row"
            @click="router.push(`/projects/${p.id}`)"
          >
            <div>
              <div style="font-weight:500">{{ p.name }}</div>
              <div class="text-muted" style="font-size:0.8125rem">by {{ ownerLabel(p) }}</div>
            </div>
            <div class="flex-gap" @click.stop>
              <span class="badge badge-gray">member</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="list.length === 0" class="card">
        <div class="card-empty">No projects yet. Create your first one.</div>
      </div>
    </template>
  </div>

  <!-- Modal -->
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>New project</h2>
        <button class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form class="form" @submit.prevent="create">
        <div class="field">
          <label>Project name</label>
          <input v-model="newName" placeholder="My App" autofocus required />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create project' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
