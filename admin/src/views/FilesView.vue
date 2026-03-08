<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { files as filesApi, projects, type MediaFile, type Project } from '../api/client'
import FileTypeIcon from '../components/FileTypeIcon.vue'

const route = useRoute()
const projectId = route.params.projectId as string

const project = ref<Project | null>(null)
const tab = ref<'project' | 'global'>('project')
const projectFiles = ref<MediaFile[]>([])
const globalFiles = ref<MediaFile[]>([])
const loading = ref(true)
const uploading = ref(false)
const uploadError = ref('')

// Edit panel
const editing = ref<MediaFile | null>(null)
const editForm = ref({ name: '', title: '', alt: '', copyright: '', focus: '', metaData: '{}' })
const saving = ref(false)
const saveError = ref('')

onMounted(async () => {
  const [p, pf, gf] = await Promise.all([
    projects.list().then(ps => ps.find(x => x.id === projectId) ?? null),
    filesApi.listForProject(projectId),
    filesApi.listGlobal(),
  ])
  project.value = p
  projectFiles.value = pf.filter(f => f.projectId !== null)
  globalFiles.value = gf
  loading.value = false
})

const currentFiles = computed(() => tab.value === 'project' ? projectFiles.value : globalFiles.value)

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const stored = tab.value === 'project'
      ? await filesApi.uploadToProject(projectId, file)
      : await filesApi.uploadGlobal(file)
    if (tab.value === 'project') projectFiles.value.unshift(stored)
    else globalFiles.value.unshift(stored)
  } catch (e: any) {
    uploadError.value = e.message
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function openEdit(f: MediaFile) {
  editing.value = f
  editForm.value = {
    name: f.name,
    title: f.title,
    alt: f.alt,
    copyright: f.copyright,
    focus: f.focus,
    metaData: JSON.stringify(f.metaData, null, 2),
  }
  saveError.value = ''
}

async function saveEdit() {
  if (!editing.value) return
  saving.value = true
  saveError.value = ''
  try {
    let metaData: Record<string, unknown> = {}
    try { metaData = JSON.parse(editForm.value.metaData) } catch { throw new Error('metaData is not valid JSON') }
    const updated = await filesApi.update(editing.value.id, {
      name: editForm.value.name,
      title: editForm.value.title,
      alt: editForm.value.alt,
      copyright: editForm.value.copyright,
      focus: editForm.value.focus,
      metaData,
    })
    // Update in list
    const list = updated.projectId ? projectFiles : globalFiles
    const idx = list.value.findIndex(f => f.id === updated.id)
    if (idx !== -1) list.value[idx] = updated
    editing.value = null
  } catch (e: any) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove(f: MediaFile) {
  if (!confirm(`Delete "${f.originalName}"?`)) return
  await filesApi.delete(f.id)
  if (f.projectId) projectFiles.value = projectFiles.value.filter(x => x.id !== f.id)
  else globalFiles.value = globalFiles.value.filter(x => x.id !== f.id)
  if (editing.value?.id === f.id) editing.value = null
}

function isImage(f: MediaFile) { return f.mimeType.startsWith('image/') }
function fileType(f: MediaFile): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/json': 'JSON',
    'application/zip': 'ZIP',
    'application/x-zip-compressed': 'ZIP',
    'application/x-rar-compressed': 'RAR',
    'application/x-7z-compressed': '7Z',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'image/svg+xml': 'SVG',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
  }
  if (map[f.mimeType]) return map[f.mimeType] as string
  const parts = f.mimeType.split('/')
  const sub = parts[1] ?? ''
  return sub ? (sub.split('+')[0] ?? sub).toUpperCase().slice(0, 5) : '—'
}
function fileUrl(url: string) { return url.startsWith('http') ? url : `http://localhost:3000${url}` }
function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="page" style="max-width:1200px">
    <div class="breadcrumb">
      <RouterLink to="/">Projects</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">Collections</RouterLink>
      <span>/</span>
      <span class="current">Files</span>
    </div>

    <div class="page-header">
      <h1>Media library</h1>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0.25rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border)">
      <button
        class="btn btn-ghost"
        :style="tab === 'project' ? 'border-bottom:2px solid var(--accent);border-radius:0;color:var(--text)' : 'border-radius:0;color:var(--text-muted)'"
        @click="tab = 'project'"
      >{{ project?.name ?? 'Project' }} files</button>
      <button
        class="btn btn-ghost"
        :style="tab === 'global' ? 'border-bottom:2px solid var(--accent);border-radius:0;color:var(--text)' : 'border-radius:0;color:var(--text-muted)'"
        @click="tab = 'global'"
      >Global files</button>
    </div>

    <div v-if="tab === 'global'" style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.875rem;color:var(--text-muted)">
      Global files are accessible from all projects.
    </div>

    <div v-if="uploadError" class="alert alert-error">{{ uploadError }}</div>

    <!-- Upload -->
    <div style="margin-bottom:1.5rem">
      <input id="upload-input" type="file" style="display:none" @change="handleUpload" />
      <label for="upload-input" class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:0.5rem">
        <span v-if="uploading">Uploading…</span>
        <span v-else>+ Upload file</span>
      </label>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <template v-else>
      <div v-if="currentFiles.length === 0" class="card">
        <div class="card-empty">No files yet. Upload your first file above.</div>
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.875rem">
        <div
          v-for="f in currentFiles"
          :key="f.id"
          style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:border-color 0.15s"
          @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'"
          @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = 'var(--border)'"
          @click="openEdit(f)"
        >
          <div style="height:110px;background:var(--surface);overflow:hidden">
            <img v-if="isImage(f)" :src="fileUrl(f.url)" style="width:100%;height:100%;object-fit:cover" />
            <div v-else style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
              <FileTypeIcon :mimeType="f.mimeType" :size="48" />
            </div>
          </div>
          <div style="padding:0.5rem">
            <div style="font-size:0.8125rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="f.name || f.originalName">
              {{ f.name || f.originalName }}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:0.125rem">
              <span>{{ formatSize(f.size) }}</span>
              <span style="font-family:monospace;font-size:0.7rem">{{ fileType(f) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Edit modal -->
  <div v-if="editing" class="modal-overlay" @click.self="editing = null">
    <div class="modal" style="width:640px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h2>Edit file</h2>
        <button class="btn btn-ghost btn-sm" @click="editing = null">✕</button>
      </div>

      <div style="display:flex;gap:1.25rem;overflow-y:auto;flex:1;min-height:0">
        <!-- Left: preview + read-only info -->
        <div style="width:200px;flex-shrink:0">
          <div style="height:180px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:0.75rem">
            <img v-if="isImage(editing)" :src="fileUrl(editing.url)" style="width:100%;height:100%;object-fit:contain" />
            <div v-else style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
              <FileTypeIcon :mimeType="editing.mimeType" :size="72" />
            </div>
          </div>
          <div style="font-size:0.8125rem;color:var(--text-muted);display:flex;flex-direction:column;gap:0.375rem">
            <div><span style="color:var(--text)">Size</span><br/>{{ formatSize(editing.size) }}</div>
            <div><span style="color:var(--text)">Type</span><br/>{{ editing.mimeType }}</div>
            <div style="word-break:break-all">
              <span style="color:var(--text)">Filename</span><br/>
              <a :href="fileUrl(editing.url)" target="_blank" style="color:var(--accent);font-size:0.75rem">{{ editing.url }}</a>
            </div>
          </div>
        </div>

        <!-- Right: form -->
        <div style="flex:1;min-width:0">
          <div v-if="saveError" class="alert alert-error" style="margin-bottom:0.75rem">{{ saveError }}</div>
          <form class="form" @submit.prevent="saveEdit" style="gap:0.625rem">
            <div class="field">
              <label>Name</label>
              <input v-model="editForm.name" placeholder="Image name" autofocus />
            </div>
            <div class="field">
              <label>Title</label>
              <input v-model="editForm.title" placeholder="Display title" />
            </div>
            <div class="field">
              <label>Alt text</label>
              <input v-model="editForm.alt" placeholder="Describe the image" />
            </div>
            <div class="field">
              <label>Copyright</label>
              <input v-model="editForm.copyright" placeholder="© Photographer name" />
            </div>
            <div class="field">
              <label>Focus</label>
              <input v-model="editForm.focus" placeholder="e.g. 50% 30%" />
            </div>
            <div class="field">
              <label>Meta data <span class="text-muted">(JSON)</span></label>
              <textarea v-model="editForm.metaData" rows="3" style="font-family:monospace;font-size:0.8125rem;resize:vertical" />
            </div>
          </form>
        </div>
      </div>

      <div class="modal-footer" style="justify-content:space-between">
        <button class="btn btn-danger btn-sm" @click="remove(editing!)">Delete</button>
        <div class="flex-gap">
          <button class="btn btn-ghost" @click="editing = null">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
