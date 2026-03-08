<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { projects, exportImport, type Project } from '../api/client'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
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
  if (!confirm(t('projects.confirmDelete', { name: p.name }))) return
  await projects.delete(p.id)
  list.value = list.value.filter(x => x.id !== p.id)
}

function ownerLabel(p: Project) {
  return p.user.name || p.user.email
}

const importingProject = ref<string | null>(null)

async function handleProjectImport(p: Project, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importingProject.value = p.id
  try {
    const result = await exportImport.importProject(p.id, file)
    alert(t('projects.importComplete', { collections: result.collections, records: result.records }))
  } catch (e: any) {
    alert(e.message)
  } finally {
    importingProject.value = null
    input.value = ''
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>{{ $t('projects.title') }}</h1>
      <button class="btn btn-primary" @click="showModal = true">{{ $t('projects.newProject') }}</button>
    </div>

    <div v-if="loading" class="text-muted">{{ $t('common.loading') }}</div>

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
              <span class="badge badge-purple">{{ $t('projects.ownerBadge') }}</span>
              <button class="btn btn-ghost btn-sm" @click="exportImport.exportProject(p.id, p.name)">{{ $t('projects.export') }}</button>
              <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                <span v-if="importingProject === p.id">{{ $t('projects.importing') }}</span>
                <span v-else>{{ $t('projects.import') }}</span>
                <input type="file" accept=".json" style="display:none" @change="handleProjectImport(p, $event)" />
              </label>
              <button class="btn btn-danger btn-sm" @click="remove(p)">{{ $t('common.delete') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Shared with me -->
      <div v-if="sharedProjects.length > 0" class="section">
        <div class="section-header">
          <h3>{{ $t('projects.sharedWithMe') }}</h3>
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
              <div class="text-muted" style="font-size:0.8125rem">{{ $t('projects.byOwner', { owner: ownerLabel(p) }) }}</div>
            </div>
            <div class="flex-gap" @click.stop>
              <span class="badge badge-gray">{{ $t('projects.memberBadge') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="list.length === 0" class="card">
        <div class="card-empty">{{ $t('projects.noProjects') }}</div>
      </div>
    </template>
  </div>

  <!-- Modal -->
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ $t('projects.newProjectModal') }}</h2>
        <button class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form class="form" @submit.prevent="create">
        <div class="field">
          <label>{{ $t('projects.projectName') }}</label>
          <input v-model="newName" :placeholder="$t('projects.projectPlaceholder')" autofocus required />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? $t('projects.creating') : $t('projects.createProject') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
