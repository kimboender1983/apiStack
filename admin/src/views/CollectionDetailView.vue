<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import {
  fields as fieldsApi,
  relations as relationsApi,
  collections,
  type Field,
  type FieldPayload,
  type Relation,
  type Collection,
} from '../api/client'
import { useProjectRole } from '../composables/useProjectRole'

const route = useRoute()
const projectId = route.params.projectId as string
const collectionId = route.params.collectionId as string

const { canEdit } = useProjectRole(projectId)

const collection = ref<Collection | null>(null)
const fieldList = ref<Field[]>([])
const relationList = ref<Relation[]>([])
const allCollections = ref<Collection[]>([])
const loading = ref(true)

// ── Inline field form ─────────────────────────────────────────────────────────
const nameInput = ref<HTMLInputElement | null>(null)
const editingField = ref<Field | null>(null)
const fieldForm = ref<FieldPayload & { enumInput: string }>({
  name: '', type: 'string', required: false, defaultValue: '', enumValues: [], enumInput: '',
})
const savingField = ref(false)
const fieldError = ref('')

function resetForm(keepType = true) {
  fieldForm.value = {
    name: '',
    type: keepType ? fieldForm.value.type : 'string',
    required: keepType ? fieldForm.value.required : false,
    defaultValue: '',
    enumValues: [],
    enumInput: '',
  }
  editingField.value = null
  fieldError.value = ''
  nextTick(() => nameInput.value?.focus())
}

function startEdit(f: Field) {
  editingField.value = f
  fieldForm.value = {
    name: f.name,
    type: f.type,
    required: f.required,
    defaultValue: f.defaultValue ?? '',
    enumValues: f.enumValues ? [...f.enumValues] : [],
    enumInput: '',
  }
  fieldError.value = ''
  nextTick(() => nameInput.value?.focus())
}

function addEnumValue() {
  const val = fieldForm.value.enumInput.trim()
  if (!val || fieldForm.value.enumValues!.includes(val)) return
  fieldForm.value.enumValues!.push(val)
  fieldForm.value.enumInput = ''
}

function removeEnumValue(val: string) {
  fieldForm.value.enumValues = fieldForm.value.enumValues!.filter(v => v !== val)
}

async function saveField() {
  if (!fieldForm.value.name.trim()) return
  savingField.value = true
  fieldError.value = ''
  const payload: FieldPayload = {
    name: fieldForm.value.name.trim(),
    type: fieldForm.value.type,
    required: fieldForm.value.required,
    defaultValue: fieldForm.value.defaultValue || undefined,
    enumValues: fieldForm.value.type === 'enum' ? fieldForm.value.enumValues : undefined,
  }
  try {
    if (editingField.value) {
      const updated = await fieldsApi.update(projectId, collectionId, editingField.value.id, payload)
      const idx = fieldList.value.findIndex(f => f.id === editingField.value!.id)
      if (idx !== -1) fieldList.value[idx] = updated
      resetForm(false)
    } else {
      const created = await fieldsApi.create(projectId, collectionId, payload)
      fieldList.value.push(created)
      resetForm(true) // keep type for rapid sequential entry
    }
  } catch (e: any) {
    fieldError.value = e.message
  } finally {
    savingField.value = false
  }
}

async function deleteField(f: Field) {
  if (!confirm(`Delete field "${f.name}"?`)) return
  await fieldsApi.delete(projectId, collectionId, f.id)
  fieldList.value = fieldList.value.filter(x => x.id !== f.id)
  if (editingField.value?.id === f.id) resetForm(false)
}

async function onDragEnd() {
  await fieldsApi.reorder(projectId, collectionId, fieldList.value.map(f => f.id))
}

// ── Relations ─────────────────────────────────────────────────────────────────
const showRelationModal = ref(false)
const newRelation = ref({ fieldName: '', relationType: 'one_to_one', targetCollectionId: '' })
const creatingRelation = ref(false)
const relationError = ref('')

async function createRelation() {
  if (!newRelation.value.fieldName || !newRelation.value.targetCollectionId) return
  creatingRelation.value = true
  relationError.value = ''
  try {
    const r = await relationsApi.create(projectId, collectionId, newRelation.value)
    relationList.value.push(r)
    newRelation.value = { fieldName: '', relationType: 'one_to_one', targetCollectionId: '' }
    showRelationModal.value = false
  } catch (e: any) {
    relationError.value = e.message
  } finally {
    creatingRelation.value = false
  }
}

async function deleteRelation(r: Relation) {
  if (!confirm(`Delete relation "${r.fieldName}"?`)) return
  await relationsApi.delete(projectId, collectionId, r.id)
  relationList.value = relationList.value.filter(x => x.id !== r.id)
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  const [col, allCols, fl, rl] = await Promise.all([
    collections.list(projectId).then(cs => cs.find(c => c.id === collectionId) ?? null),
    collections.list(projectId),
    fieldsApi.list(projectId, collectionId),
    relationsApi.list(projectId, collectionId),
  ])
  collection.value = col
  allCollections.value = allCols.filter(c => c.id !== collectionId)
  fieldList.value = fl
  relationList.value = rl
  loading.value = false
  nextTick(() => nameInput.value?.focus())
})

// ── Endpoints ─────────────────────────────────────────────────────────────────
const slug = computed(() => collection.value?.slug ?? '')
const baseUrl = computed(() => `http://localhost:3000/api/${slug.value}`)
const endpoints = computed(() => [
  { method: 'GET',    path: `${baseUrl.value}`,     desc: 'List all records' },
  { method: 'GET',    path: `${baseUrl.value}/:id`,  desc: 'Get one record' },
  { method: 'POST',   path: `${baseUrl.value}`,     desc: 'Create a record' },
  { method: 'PUT',    path: `${baseUrl.value}/:id`,  desc: 'Update a record' },
  { method: 'DELETE', path: `${baseUrl.value}/:id`,  desc: 'Delete a record' },
])
const methodColor: Record<string, string> = {
  GET: '#22c55e', POST: '#6c63ff', PUT: '#f59e0b', DELETE: '#ef4444',
}

const fieldTypes = ['string', 'text', 'richtext', 'integer', 'float', 'boolean', 'date', 'datetime', 'json', 'enum', 'file']
</script>

<template>
  <div class="page">
    <div class="breadcrumb">
      <RouterLink to="/">Projects</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">Collections</RouterLink>
      <span>/</span>
      <span class="current">{{ collection?.name ?? '…' }}</span>
    </div>

    <div class="page-header">
      <h1>{{ collection?.name }}</h1>
      <RouterLink :to="`/projects/${projectId}/collections/${collectionId}/data`" class="btn btn-primary">
        Manage data →
      </RouterLink>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <template v-else>
      <!-- Fields -->
      <div class="section">
        <div class="section-header">
          <h3>Fields</h3>
          <span v-if="canEdit()" class="text-muted" style="font-size:0.8125rem">Drag to reorder</span>
        </div>

        <!-- Sortable field list -->
        <div class="card" style="margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
          <VueDraggable
            v-model="fieldList"
            handle=".drag-handle"
            :animation="150"
            @end="onDragEnd"
          >
            <div
              v-for="f in fieldList"
              :key="f.id"
              class="card-row"
              :style="editingField?.id === f.id ? 'background:var(--surface-2);cursor:default' : 'cursor:default'"
            >
              <!-- Drag handle (editors only) -->
              <span
                v-if="canEdit()"
                class="drag-handle"
                style="cursor:grab;color:var(--text-muted);padding:0 0.375rem;font-size:1rem;user-select:none;touch-action:none"
                title="Drag to reorder"
              >⠿</span>
              <span v-else style="padding:0 0.375rem;width:1.5rem;display:inline-block" />

              <div class="flex-gap" style="flex:1;flex-wrap:wrap;gap:0.375rem">
                <span style="font-weight:500;font-family:monospace">{{ f.name }}</span>
                <span class="badge badge-purple">{{ f.type }}</span>
                <span v-if="f.required" class="badge badge-red">required</span>
                <template v-if="f.type === 'enum' && f.enumValues?.length">
                  <span
                    v-for="v in f.enumValues"
                    :key="v"
                    class="badge badge-gray"
                    style="font-family:monospace"
                  >{{ v }}</span>
                </template>
              </div>

              <div v-if="canEdit()" class="flex-gap">
                <button class="btn btn-ghost btn-sm" @click="startEdit(f)">Edit</button>
                <button class="btn btn-danger btn-sm" @click="deleteField(f)">Delete</button>
              </div>
            </div>
          </VueDraggable>
          <div v-if="fieldList.length === 0" class="card-empty">
            {{ canEdit() ? 'No fields yet — add one below.' : 'No fields yet.' }}
          </div>
        </div>

        <!-- Inline add/edit form (editors only) -->
        <div v-if="canEdit()" style="border:1px solid var(--border);border-top:none;border-bottom-left-radius:var(--radius);border-bottom-right-radius:var(--radius);background:var(--surface-2);padding:0.875rem 1rem">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.625rem">
            {{ editingField ? `Editing: ${editingField.name}` : 'Add field' }}
          </div>

          <div v-if="fieldError" class="alert alert-error" style="margin-bottom:0.625rem;font-size:0.8125rem">{{ fieldError }}</div>

          <form @submit.prevent="saveField">
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end">
              <!-- Name -->
              <div class="field" style="flex:1;min-width:140px;margin:0">
                <label style="font-size:0.75rem">Name</label>
                <input
                  ref="nameInput"
                  v-model="fieldForm.name"
                  placeholder="field_name"
                  required
                  style="font-family:monospace"
                />
              </div>

              <!-- Type -->
              <div class="field" style="min-width:130px;margin:0">
                <label style="font-size:0.75rem">Type</label>
                <select v-model="fieldForm.type">
                  <option v-for="t in fieldTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <!-- Required -->
              <div style="display:flex;align-items:center;gap:0.375rem;padding-bottom:0.25rem">
                <input id="req" v-model="fieldForm.required" type="checkbox" style="width:auto" />
                <label for="req" style="margin:0;cursor:pointer;font-size:0.875rem;white-space:nowrap">Required</label>
              </div>

              <!-- Default value -->
              <div class="field" style="min-width:120px;margin:0">
                <label style="font-size:0.75rem">Default <span class="text-muted">(optional)</span></label>
                <input v-model="fieldForm.defaultValue" placeholder="e.g. false" />
              </div>

              <!-- Actions -->
              <div style="display:flex;gap:0.375rem;padding-bottom:0.125rem">
                <button type="submit" class="btn btn-primary btn-sm" :disabled="savingField" style="white-space:nowrap">
                  {{ savingField ? '…' : editingField ? 'Save changes' : '+ Add field' }}
                </button>
                <button v-if="editingField" type="button" class="btn btn-ghost btn-sm" @click="resetForm(false)">
                  Cancel
                </button>
              </div>
            </div>

            <!-- Enum values (shown below when type = enum) -->
            <div v-if="fieldForm.type === 'enum'" style="margin-top:0.625rem">
              <div style="display:flex;gap:0.5rem">
                <input
                  v-model="fieldForm.enumInput"
                  placeholder="Add a value…"
                  style="flex:1"
                  @keydown.enter.prevent="addEnumValue"
                />
                <button type="button" class="btn btn-ghost btn-sm" @click="addEnumValue">Add</button>
              </div>
              <div v-if="fieldForm.enumValues!.length" style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.5rem">
                <span
                  v-for="v in fieldForm.enumValues"
                  :key="v"
                  class="badge badge-purple"
                  style="cursor:pointer;display:inline-flex;align-items:center;gap:0.25rem"
                  @click="removeEnumValue(v)"
                >{{ v }} ✕</span>
              </div>
              <p v-else class="text-muted" style="font-size:0.8125rem;margin-top:0.25rem">No values yet.</p>
            </div>
          </form>
        </div>
      </div>

      <!-- Relations -->
      <div class="section">
        <div class="section-header">
          <h3>Relations</h3>
          <button
            v-if="canEdit()"
            class="btn btn-primary btn-sm"
            :disabled="allCollections.length === 0"
            @click="showRelationModal = true"
          >+ Add relation</button>
        </div>
        <div class="card">
          <div v-for="r in relationList" :key="r.id" class="card-row" style="cursor:default">
            <div class="flex-gap">
              <span style="font-weight:500;font-family:monospace">{{ r.fieldName }}</span>
              <span class="badge badge-gray">{{ r.relationType }}</span>
              <span class="text-muted">→ {{ r.targetCollection?.name ?? r.targetCollectionId }}</span>
            </div>
            <button v-if="canEdit()" class="btn btn-danger btn-sm" @click="deleteRelation(r)">Delete</button>
          </div>
          <div v-if="relationList.length === 0" class="card-empty">No relations yet.</div>
        </div>
      </div>

      <!-- Generated Endpoints -->
      <div class="section">
        <div class="section-header"><h3>Generated endpoints</h3></div>
        <div class="card">
          <div v-for="e in endpoints" :key="e.method + e.path" class="card-row" style="cursor:default">
            <div class="flex-gap">
              <span
                class="badge"
                style="font-family:monospace;min-width:60px;text-align:center"
                :style="{ background: methodColor[e.method] + '22', color: methodColor[e.method] }"
              >{{ e.method }}</span>
              <code style="font-size:0.8125rem">{{ e.path }}</code>
            </div>
            <span class="text-muted">{{ e.desc }}</span>
          </div>
        </div>
        <div style="margin-top:0.75rem">
          <div class="code-block">GET {{ baseUrl }}?filter[field]=value&amp;sort=-createdAt&amp;limit=20</div>
          <div class="code-block" style="margin-top:0.5rem">GET {{ baseUrl }}?include=relation&amp;offset=20</div>
        </div>
      </div>
    </template>
  </div>

  <!-- Relation modal -->
  <div v-if="showRelationModal" class="modal-overlay" @click.self="showRelationModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>Add relation</h2>
        <button class="btn btn-ghost btn-sm" @click="showRelationModal = false">✕</button>
      </div>
      <div v-if="relationError" class="alert alert-error">{{ relationError }}</div>
      <form class="form" @submit.prevent="createRelation">
        <div class="field">
          <label>Field name <span class="text-muted">(stored key)</span></label>
          <input v-model="newRelation.fieldName" placeholder="authorId" required />
        </div>
        <div class="field">
          <label>Relation type</label>
          <select v-model="newRelation.relationType">
            <option value="one_to_one">one_to_one</option>
            <option value="one_to_many">one_to_many</option>
            <option value="many_to_many">many_to_many</option>
          </select>
        </div>
        <div class="field">
          <label>Target collection</label>
          <select v-model="newRelation.targetCollectionId" required>
            <option value="">Select collection…</option>
            <option v-for="c in allCollections" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showRelationModal = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="creatingRelation">
            {{ creatingRelation ? 'Adding…' : 'Add relation' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
