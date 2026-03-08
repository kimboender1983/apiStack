<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  records as recordsApi,
  fields as fieldsApi,
  relations as relationsApi,
  collections,
  files as filesApi,
  exportImport,
  type ApiRecord,
  type Field,
  type StoredFile,
  type MediaFile,
  type Relation,
  type Collection,
} from '../api/client'
import FileTypeIcon from '../components/FileTypeIcon.vue'
import RichTextEditor from '../components/RichTextEditor.vue'
import { useProjectRole } from '../composables/useProjectRole'

const route = useRoute()
const { t } = useI18n()
const projectId = route.params.projectId as string
const collectionId = route.params.collectionId as string

const { canEdit } = useProjectRole(projectId)

const collection = ref<Collection | null>(null)
const fieldList = ref<Field[]>([])
const relationList = ref<Relation[]>([])
// Map of targetCollectionId → { records, slug }
const relatedRecords = ref<Record<string, { slug: string; items: ApiRecord[] }>>({})
const recordList = ref<ApiRecord[]>([])
const total = ref(0)
const loading = ref(true)
const PAGE_SIZE = 20
const offset = ref(0)

// Modal
const showModal = ref(false)
const editingRecord = ref<ApiRecord | null>(null)
const formData = ref<Record<string, unknown>>({})
const saving = ref(false)
const formError = ref('')

// Delete
const deleting = ref<string | null>(null)

// Export / Import
const importing = ref(false)
const importResult = ref<{ imported?: number; skipped?: number } | null>(null)

async function doExportJson() {
  if (!collection.value) return
  await exportImport.exportCollectionJson(projectId, collection.value.slug)
}

async function doExportCsv() {
  if (!collection.value) return
  await exportImport.exportCollectionCsv(projectId, collection.value.slug)
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !collection.value) return
  importing.value = true
  importResult.value = null
  try {
    const result = await exportImport.importCollection(projectId, collection.value.slug, file)
    importResult.value = result
    await loadRecords()
  } catch (e: any) {
    importResult.value = null
    alert(e.message)
  } finally {
    importing.value = false
    input.value = ''
  }
}

onMounted(async () => {
  const [col, fl, rl] = await Promise.all([
    collections.list(projectId).then(cs => cs.find(c => c.id === collectionId) ?? null),
    fieldsApi.list(projectId, collectionId),
    relationsApi.list(projectId, collectionId),
  ])
  collection.value = col
  fieldList.value = fl
  relationList.value = rl

  // Fetch records for each unique target collection
  const seen = new Set<string>()
  for (const rel of rl) {
    const tc = rel.targetCollection
    if (!tc || seen.has(tc.id)) continue
    seen.add(tc.id)
    const res = await recordsApi.list(projectId, tc.slug, { limit: '200' })
    relatedRecords.value[tc.id] = { slug: tc.slug, items: res.data }
  }

  await loadRecords()
  loading.value = false
})

async function loadRecords() {
  if (!collection.value) return
  const res = await recordsApi.list(projectId, collection.value.slug, {
    limit: String(PAGE_SIZE),
    offset: String(offset.value),
  })
  recordList.value = res.data
  total.value = res.meta.total
}

async function goPage(dir: 1 | -1) {
  offset.value = Math.max(0, offset.value + dir * PAGE_SIZE)
  await loadRecords()
}

// ── Form helpers ──────────────────────────────────────────────────────────────

function buildEmptyForm(): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const f of fieldList.value) {
    if (f.type === 'boolean') obj[f.name] = false
    else if (f.type === 'enum' && f.enumValues?.length) obj[f.name] = f.enumValues[0]
    else if (f.type === 'file') obj[f.name] = null
    else obj[f.name] = ''
  }
  for (const r of relationList.value) {
    const isMulti = r.relationType === 'many_to_many' || r.relationType === 'one_to_many'
    obj[r.fieldName] = isMulti ? [] : ''
  }
  return obj
}

function buildFormFromRecord(record: ApiRecord): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const f of fieldList.value) {
    const val = record[f.name]
    if (f.type === 'json') obj[f.name] = val !== undefined ? JSON.stringify(val, null, 2) : ''
    else if (f.type === 'file') obj[f.name] = val ?? null
    else obj[f.name] = val ?? ''
  }
  for (const r of relationList.value) {
    const val = record[r.fieldName]
    const isMulti = r.relationType === 'many_to_many' || r.relationType === 'one_to_many'
    obj[r.fieldName] = isMulti ? (Array.isArray(val) ? val : []) : (val ?? '')
  }
  return obj
}

function coerceForm(): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const f of fieldList.value) {
    const raw = formData.value[f.name]
    if ((raw === '' || raw === null || raw === undefined) && !f.required) continue
    if (f.type === 'file') {
      if (raw) obj[f.name] = raw // already a StoredFile object
    } else if (f.type === 'json') {
      try { obj[f.name] = JSON.parse(raw as string) } catch { throw new Error(`Invalid JSON in "${f.name}"`) }
    } else if (f.type === 'integer') {
      obj[f.name] = parseInt(raw as string, 10)
    } else if (f.type === 'float') {
      obj[f.name] = parseFloat(raw as string)
    } else if (f.type === 'boolean') {
      obj[f.name] = raw === true || raw === 'true'
    } else {
      obj[f.name] = raw
    }
  }
  for (const r of relationList.value) {
    const val = formData.value[r.fieldName]
    if (val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)) {
      obj[r.fieldName] = val
    }
  }
  return obj
}

function toggleMulti(fieldName: string, id: string) {
  const arr = (formData.value[fieldName] as string[]) ?? []
  const idx = arr.indexOf(id)
  if (idx === -1) formData.value[fieldName] = [...arr, id]
  else formData.value[fieldName] = arr.filter(x => x !== id)
}

function isSelected(fieldName: string, id: string): boolean {
  return ((formData.value[fieldName] as string[]) ?? []).includes(id)
}

// ── File picker ───────────────────────────────────────────────────────────────
const showPicker = ref(false)
const pickerField = ref<string | null>(null)
const pickerFiles = ref<MediaFile[]>([])
const pickerLoading = ref(false)
const pickerUploading = ref(false)
const pickerError = ref('')
const pickerTab = ref<'all' | 'images'>('all')

const filteredPickerFiles = computed(() =>
  pickerTab.value === 'images'
    ? pickerFiles.value.filter(f => f.mimeType.startsWith('image/'))
    : pickerFiles.value
)

async function openPicker(fieldName: string) {
  pickerField.value = fieldName
  pickerError.value = ''
  pickerTab.value = 'all'
  showPicker.value = true
  pickerLoading.value = true
  try {
    pickerFiles.value = await filesApi.listForProject(projectId)
  } finally {
    pickerLoading.value = false
  }
}

function pickFile(f: MediaFile) {
  if (!pickerField.value) return
  formData.value[pickerField.value] = {
    url: f.url,
    filename: f.filename,
    originalName: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
  } as StoredFile
  showPicker.value = false
}

async function handlePickerUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pickerUploading.value = true
  pickerError.value = ''
  try {
    const stored = await filesApi.uploadToProject(projectId, file)
    pickerFiles.value.unshift(stored)
    pickFile(stored)
  } catch (e: any) {
    pickerError.value = e.message
  } finally {
    pickerUploading.value = false
    input.value = ''
  }
}

function openCreate() {
  editingRecord.value = null
  formData.value = buildEmptyForm()
  formError.value = ''
  showModal.value = true
}

function openEdit(record: ApiRecord) {
  editingRecord.value = record
  formData.value = buildFormFromRecord(record)
  formError.value = ''
  showModal.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const data = coerceForm()
    if (editingRecord.value) {
      const updated = await recordsApi.update(projectId, collection.value!.slug, editingRecord.value.id, data)
      const idx = recordList.value.findIndex(r => r.id === editingRecord.value!.id)
      if (idx !== -1) recordList.value[idx] = updated
    } else {
      const created = await recordsApi.create(projectId, collection.value!.slug, data)
      recordList.value.unshift(created)
      total.value++
    }
    showModal.value = false
  } catch (e: any) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove(record: ApiRecord) {
  if (!confirm(t('data.confirmDelete'))) return
  deleting.value = record.id
  await recordsApi.delete(projectId, collection.value!.slug, record.id)
  recordList.value = recordList.value.filter(r => r.id !== record.id)
  total.value--
  deleting.value = null
}

// ── Display helpers ───────────────────────────────────────────────────────────

const columns = computed(() => [
  ...fieldList.value.map(f => f.name),
  ...relationList.value.map(r => r.fieldName),
])

function displayValue(record: ApiRecord, key: string): string {
  const val = record[key]
  if (val === null || val === undefined) return '\u2014'
  if (Array.isArray(val)) return `[${val.length} linked]`
  if (typeof val === 'object' && (val as any).url) return (val as StoredFile).originalName
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'string' && val.startsWith('<')) {
    // strip HTML tags for table preview
    return val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) + (val.length > 80 ? '\u2026' : '')
  }
  return String(val)
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function fileValue(record: ApiRecord, key: string): StoredFile | null {
  const val = record[key]
  if (val && typeof val === 'object' && (val as any).url) return val as StoredFile
  return null
}

function fileUrl(url: string): string {
  return url.startsWith('http') ? url : `http://localhost:3000${url}`
}

function labelFor(_rel: Relation, record: ApiRecord): string {
  // Try to find a meaningful label field: name, title, label, or fallback to id
  const candidates = ['name', 'title', 'label', 'slug']
  for (const c of candidates) {
    if (record[c]) return String(record[c])
  }
  return record.id.slice(0, 8) + '\u2026'
}

const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE))
const currentPage = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)

function importResultText(): string {
  if (!importResult.value) return ''
  const n = importResult.value.imported ?? 0
  const base = t('data.importedResult', n, { imported: n } as any)
  if (importResult.value.skipped) {
    return base + t('data.skipped', { skipped: importResult.value.skipped })
  }
  return base + '.'
}
</script>

<template>
  <div class="page" style="max-width:1200px">
    <div class="breadcrumb">
      <RouterLink to="/">{{ $t('nav.projects') }}</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">{{ $t('nav.collections') }}</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}/collections/${collectionId}`">
        {{ collection?.name ?? '\u2026' }}
      </RouterLink>
      <span>/</span>
      <span class="current">{{ $t('data.title') }}</span>
    </div>

    <div class="page-header">
      <div>
        <h1>{{ collection?.name }} {{ $t('data.title').toLowerCase() }}</h1>
        <p class="text-muted" style="margin-top:0.25rem">{{ $t('data.records', { count: total }) }}</p>
      </div>
      <div class="flex-gap">
        <button class="btn btn-ghost btn-sm" @click="doExportJson">{{ $t('data.exportJson') }}</button>
        <button class="btn btn-ghost btn-sm" @click="doExportCsv">{{ $t('data.exportCsv') }}</button>
        <label v-if="canEdit()" class="btn btn-ghost btn-sm" style="cursor:pointer">
          <span v-if="importing">{{ $t('data.importing') }}</span>
          <span v-else>{{ $t('data.import') }}</span>
          <input type="file" accept=".json,.csv" style="display:none" :disabled="importing" @change="handleImport" />
        </label>
        <button v-if="canEdit()" class="btn btn-primary" @click="openCreate">{{ $t('data.addRecord') }}</button>
      </div>
    </div>

    <div v-if="importResult" class="alert" style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:0.625rem 0.875rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <span>{{ importResultText() }}</span>
      <button class="btn btn-ghost btn-sm" @click="importResult = null">✕</button>
    </div>

    <div v-if="loading" class="text-muted">{{ $t('common.loading') }}</div>

    <template v-else>
      <div v-if="fieldList.length === 0 && relationList.length === 0" class="card">
        <div class="card-empty">
          {{ $t('data.noFields') }}
          <RouterLink :to="`/projects/${projectId}/collections/${collectionId}`">{{ $t('data.addFieldsFirst') }}</RouterLink>
        </div>
      </div>

      <div v-else style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th
                v-for="col in columns" :key="col"
                style="text-align:left;padding:0.5rem 0.75rem;color:var(--text-muted);font-weight:500;white-space:nowrap"
              >{{ col }}</th>
              <th style="text-align:left;padding:0.5rem 0.75rem;color:var(--text-muted);font-weight:500">{{ $t('data.created') }}</th>
              <th style="width:100px"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in recordList" :key="record.id"
              style="border-bottom:1px solid var(--border);transition:background 0.1s"
              @mouseenter="($event.currentTarget as HTMLElement).style.background = 'var(--surface-2)'"
              @mouseleave="($event.currentTarget as HTMLElement).style.background = ''"
            >
              <td
                v-for="col in columns" :key="col"
                style="padding:0.625rem 0.75rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              >
                <template v-if="fileValue(record, col)">
                  <a :href="fileUrl(fileValue(record, col)!.url)" target="_blank" style="display:inline-flex;align-items:center;gap:0.375rem">
                    <img
                      v-if="isImageMime(fileValue(record, col)!.mimeType)"
                      :src="fileUrl(fileValue(record, col)!.url)"
                      style="height:28px;width:28px;object-fit:cover;border-radius:4px;border:1px solid var(--border)"
                    />
                    <span>{{ fileValue(record, col)!.originalName }}</span>
                  </a>
                </template>
                <span v-else-if="displayValue(record, col) === '\u2014'" class="text-muted">&mdash;</span>
                <span v-else>{{ displayValue(record, col) }}</span>
              </td>
              <td style="padding:0.625rem 0.75rem;color:var(--text-muted);white-space:nowrap">
                {{ new Date(record.createdAt).toLocaleDateString() }}
              </td>
              <td style="padding:0.625rem 0.75rem">
                <div v-if="canEdit()" class="flex-gap">
                  <button class="btn btn-ghost btn-sm" @click="openEdit(record)">{{ $t('common.edit') }}</button>
                  <button class="btn btn-danger btn-sm" :disabled="deleting === record.id" @click="remove(record)">{{ $t('common.delete') }}</button>
                </div>
              </td>
            </tr>
            <tr v-if="recordList.length === 0">
              <td :colspan="columns.length + 2" style="padding:2rem;text-align:center;color:var(--text-muted)">
                {{ $t('data.noRecords') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" style="display:flex;align-items:center;justify-content:space-between;margin-top:1rem">
        <span class="text-muted">{{ $t('data.pageOf', { current: currentPage, total: totalPages }) }}</span>
        <div class="flex-gap">
          <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="goPage(-1)">{{ $t('data.prevPage') }}</button>
          <button class="btn btn-ghost btn-sm" :disabled="currentPage >= totalPages" @click="goPage(1)">{{ $t('data.nextPage') }}</button>
        </div>
      </div>
    </template>
  </div>

  <!-- Record modal -->
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal" style="width:540px;max-height:85vh;overflow-y:auto">
      <div class="modal-header">
        <h2>{{ editingRecord ? $t('data.editRecord') : $t('data.addRecordModal') }}</h2>
        <button class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
      </div>

      <div v-if="formError" class="alert alert-error">{{ formError }}</div>

      <form class="form" @submit.prevent="save">

        <!-- ── Regular fields ── -->
        <template v-for="f in fieldList" :key="f.id">
          <div v-if="f.type === 'boolean'" class="field" style="flex-direction:row;align-items:center;gap:0.5rem">
            <input :id="`f-${f.id}`" v-model="formData[f.name]" type="checkbox" style="width:auto" />
            <label :for="`f-${f.id}`" style="margin:0;cursor:pointer">
              {{ f.name }}<span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
          </div>

          <div v-else-if="f.type === 'enum'" class="field">
            <label>{{ f.name }}<span v-if="f.required" style="color:var(--danger)">*</span></label>
            <select v-model="formData[f.name]" :required="f.required">
              <option v-if="!f.required" value="">&mdash; none &mdash;</option>
              <option v-for="v in f.enumValues" :key="v" :value="v">{{ v }}</option>
            </select>
          </div>

          <div v-else-if="f.type === 'richtext'" class="field">
            <label>
              {{ f.name }}
              <span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
            <RichTextEditor v-model="formData[f.name] as string" :placeholder="f.defaultValue ?? ''" />
          </div>

          <div v-else-if="f.type === 'text' || f.type === 'json'" class="field">
            <label>
              {{ f.name }}
              <span class="text-muted" style="font-size:0.75rem;margin-left:0.25rem">{{ f.type }}</span>
              <span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
            <textarea v-model="formData[f.name] as string" :rows="f.type === 'json' ? 4 : 3" :required="f.required" style="resize:vertical" />
          </div>

          <div v-else-if="f.type === 'date' || f.type === 'datetime'" class="field">
            <label>{{ f.name }}<span v-if="f.required" style="color:var(--danger)">*</span></label>
            <input v-model="formData[f.name] as string" :type="f.type === 'date' ? 'date' : 'datetime-local'" :required="f.required" />
          </div>

          <div v-else-if="f.type === 'integer' || f.type === 'float'" class="field">
            <label>
              {{ f.name }}
              <span class="text-muted" style="font-size:0.75rem;margin-left:0.25rem">{{ f.type }}</span>
              <span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
            <input v-model="formData[f.name] as string" type="number" :step="f.type === 'float' ? 'any' : '1'" :required="f.required" />
          </div>

          <!-- File -->
          <div v-else-if="f.type === 'file'" class="field">
            <label>
              {{ f.name }}
              <span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
            <div v-if="formData[f.name]" style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:0.5rem">
              <img
                v-if="isImageMime((formData[f.name] as StoredFile).mimeType)"
                :src="fileUrl((formData[f.name] as StoredFile).url)"
                style="height:40px;width:40px;object-fit:cover;border-radius:4px"
              />
              <div>
                <div style="font-size:0.875rem;font-weight:500">{{ (formData[f.name] as StoredFile).originalName }}</div>
                <div class="text-muted" style="font-size:0.75rem">{{ ((formData[f.name] as StoredFile).size / 1024).toFixed(1) }} KB</div>
              </div>
              <button type="button" class="btn btn-danger btn-sm" style="margin-left:auto" @click="formData[f.name] = null">{{ $t('data.remove') }}</button>
            </div>
            <button
              type="button"
              class="btn btn-ghost"
              style="width:100%;border-style:dashed"
              @click="openPicker(f.name)"
            >{{ formData[f.name] ? $t('data.replaceFile') : $t('data.chooseFromLibrary') }}</button>
          </div>

          <!-- String (default) -->
          <div v-else class="field">
            <label>
              {{ f.name }}
              <span class="text-muted" style="font-size:0.75rem;margin-left:0.25rem">{{ f.type }}</span>
              <span v-if="f.required" style="color:var(--danger)">*</span>
            </label>
            <input v-model="formData[f.name] as string" type="text" :placeholder="f.defaultValue ?? ''" :required="f.required" />
          </div>
        </template>

        <!-- ── Relation fields ── -->
        <template v-for="rel in relationList" :key="rel.id">
          <div v-if="rel.targetCollection" class="field">
            <label>
              {{ rel.fieldName }}
              <span class="badge badge-gray" style="margin-left:0.375rem">{{ rel.relationType }}</span>
              <span class="text-muted" style="font-size:0.75rem;margin-left:0.375rem">&rarr; {{ rel.targetCollection.name }}</span>
            </label>

            <!-- one_to_one: single select -->
            <select
              v-if="rel.relationType === 'one_to_one'"
              v-model="formData[rel.fieldName]"
            >
              <option value="">&mdash; none &mdash;</option>
              <option
                v-for="r in relatedRecords[rel.targetCollection.id]?.items ?? []"
                :key="r.id"
                :value="r.id"
              >{{ labelFor(rel, r) }}</option>
            </select>

            <!-- many_to_many / one_to_many: checkbox list -->
            <div
              v-else
              style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);max-height:180px;overflow-y:auto;padding:0.5rem"
            >
              <div
                v-for="r in relatedRecords[rel.targetCollection.id]?.items ?? []"
                :key="r.id"
                style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0;cursor:pointer"
                @click="toggleMulti(rel.fieldName, r.id)"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(rel.fieldName, r.id)"
                  style="width:auto;pointer-events:none"
                />
                <span>{{ labelFor(rel, r) }}</span>
              </div>
              <div
                v-if="(relatedRecords[rel.targetCollection.id]?.items ?? []).length === 0"
                class="text-muted"
                style="font-size:0.8125rem;padding:0.25rem 0"
              >
                {{ $t('data.noRecordsInCollection', { name: rel.targetCollection.name }) }}
              </div>
            </div>

            <!-- Selected count for multi -->
            <p
              v-if="rel.relationType !== 'one_to_one'"
              class="text-muted"
              style="font-size:0.8125rem;margin-top:0.25rem"
            >
              {{ $t('data.selected', { count: ((formData[rel.fieldName] as string[]) ?? []).length }) }}
            </p>
          </div>
        </template>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showModal = false">{{ $t('data.cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? $t('data.saving') : (editingRecord ? $t('data.saveChanges') : $t('data.addRecordModal')) }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- File picker modal -->
  <div v-if="showPicker" class="modal-overlay" @click.self="showPicker = false">
    <div class="modal" style="width:680px;max-height:85vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h2>{{ $t('data.chooseFileModal') }}</h2>
        <button class="btn btn-ghost btn-sm" @click="showPicker = false">✕</button>
      </div>

      <!-- Tabs + upload -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 0.75rem;gap:0.5rem">
        <div style="display:flex;gap:0.25rem">
          <button
            class="btn btn-ghost btn-sm"
            :style="pickerTab === 'all' ? 'background:var(--surface-2)' : ''"
            @click="pickerTab = 'all'"
          >{{ $t('data.all') }}</button>
          <button
            class="btn btn-ghost btn-sm"
            :style="pickerTab === 'images' ? 'background:var(--surface-2)' : ''"
            @click="pickerTab = 'images'"
          >{{ $t('data.images') }}</button>
        </div>
        <div v-if="canEdit()">
          <input id="picker-upload" type="file" style="display:none" @change="handlePickerUpload" />
          <label for="picker-upload" class="btn btn-primary btn-sm" style="cursor:pointer">
            <span v-if="pickerUploading">{{ $t('data.uploading') }}</span>
            <span v-else>{{ $t('data.uploadNew') }}</span>
          </label>
        </div>
      </div>

      <div v-if="pickerError" class="alert alert-error" style="margin-bottom:0.75rem">{{ pickerError }}</div>

      <!-- File grid -->
      <div style="overflow-y:auto;flex:1;min-height:0">
        <div v-if="pickerLoading" class="text-muted" style="padding:2rem;text-align:center">{{ $t('common.loading') }}</div>
        <div v-else-if="filteredPickerFiles.length === 0" class="text-muted" style="padding:2rem;text-align:center">
          {{ $t('data.noFilesYet') }}
        </div>
        <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.75rem;padding:0.25rem">
          <div
            v-for="f in filteredPickerFiles"
            :key="f.id"
            style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:border-color 0.15s"
            @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = 'var(--border)'"
            @click="pickFile(f)"
          >
            <div style="height:90px;background:var(--surface);overflow:hidden">
              <img
                v-if="f.mimeType.startsWith('image/')"
                :src="fileUrl(f.url)"
                style="width:100%;height:100%;object-fit:cover"
              />
              <div v-else style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
                <FileTypeIcon :mimeType="f.mimeType" :size="44" />
              </div>
            </div>
            <div style="padding:0.375rem 0.5rem">
              <div style="font-size:0.75rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="f.originalName">
                {{ f.originalName }}
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:0.125rem">
                <span>{{ (f.size / 1024).toFixed(0) }} KB</span>
                <span v-if="!f.projectId" class="badge badge-gray" style="font-size:0.6rem;padding:0.05rem 0.3rem">global</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
