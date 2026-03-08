<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiKeys, projects, type ApiKey, type Project } from '../api/client'

const route = useRoute()
const { t } = useI18n()
const projectId = route.params.projectId as string

const project = ref<Project | null>(null)
const list = ref<ApiKey[]>([])
const loading = ref(true)
const showModal = ref(false)
const newKey = ref({ name: '', permissions: 'read', rateLimitPerMinute: 60, rateLimitPerHour: 1000 })
const creating = ref(false)
const error = ref('')
const createdKey = ref<string | null>(null)

onMounted(async () => {
  const [p, keys] = await Promise.all([
    projects.list().then(ps => ps.find(x => x.id === projectId) ?? null),
    apiKeys.list(projectId),
  ])
  project.value = p
  list.value = keys
  loading.value = false
})

async function create() {
  creating.value = true
  error.value = ''
  try {
    const res = await apiKeys.create(projectId, newKey.value)
    createdKey.value = res.apiKey
    list.value.unshift(res.record)
    newKey.value = { name: '', permissions: 'read', rateLimitPerMinute: 60, rateLimitPerHour: 1000 }
  } catch (e: any) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}

async function remove(k: ApiKey) {
  if (!confirm(t('apiKeys.confirmRevoke', { name: k.name ?? k.keyPrefix }))) return
  await apiKeys.delete(projectId, k.id)
  list.value = list.value.filter(x => x.id !== k.id)
}

function copyKey() {
  if (createdKey.value) navigator.clipboard.writeText(createdKey.value)
}

const permColor: Record<string, string> = {
  read: 'badge-gray',
  write: 'badge-purple',
  admin: 'badge-red',
}
</script>

<template>
  <div class="page">
    <div class="breadcrumb">
      <RouterLink to="/">{{ $t('nav.projects') }}</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">{{ project?.name ?? '\u2026' }}</RouterLink>
      <span>/</span>
      <span class="current">{{ $t('apiKeys.title') }}</span>
    </div>

    <div class="page-header">
      <h1>{{ $t('apiKeys.title') }}</h1>
      <button class="btn btn-primary" @click="showModal = true; createdKey = null">
        {{ $t('apiKeys.generateKey') }}
      </button>
    </div>

    <!-- New key banner -->
    <div v-if="createdKey" class="alert alert-success" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
      <div>
        <strong>{{ $t('apiKeys.copyNow') }}</strong> &mdash; {{ $t('apiKeys.wontShowAgain') }}<br />
        <code style="font-family:monospace;font-size:0.8125rem">{{ createdKey }}</code>
      </div>
      <button class="btn btn-ghost btn-sm" @click="copyKey">{{ $t('apiKeys.copy') }}</button>
    </div>

    <div v-if="loading" class="text-muted">{{ $t('common.loading') }}</div>

    <div v-else class="card">
      <div v-for="k in list" :key="k.id" class="card-row" style="cursor:default">
        <div>
          <div class="flex-gap">
            <span style="font-weight:500">{{ k.name ?? $t('apiKeys.unnamed') }}</span>
            <span class="badge" :class="permColor[k.permissions]">{{ k.permissions }}</span>
          </div>
          <div class="text-muted" style="font-size:0.8125rem;margin-top:0.25rem">
            {{ $t('apiKeys.prefix') }} <code>{{ k.keyPrefix }}&hellip;</code>
            &middot; {{ k.rateLimitPerMinute }}/min
            &middot; {{ k.rateLimitPerHour }}/hr
            <span v-if="k.lastUsedAt"> &middot; {{ $t('apiKeys.lastUsed', { date: new Date(k.lastUsedAt).toLocaleDateString() }) }}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" @click="remove(k)">{{ $t('apiKeys.revoke') }}</button>
      </div>
      <div v-if="list.length === 0" class="card-empty">{{ $t('apiKeys.noKeys') }}</div>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ $t('apiKeys.generateModal') }}</h2>
        <button class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form class="form" @submit.prevent="create">
        <div class="field">
          <label>{{ $t('apiKeys.keyName') }}</label>
          <input v-model="newKey.name" :placeholder="$t('apiKeys.keyNamePlaceholder')" autofocus required />
        </div>
        <div class="field">
          <label>{{ $t('apiKeys.permissions') }}</label>
          <select v-model="newKey.permissions">
            <option value="read">{{ $t('apiKeys.permRead') }}</option>
            <option value="write">{{ $t('apiKeys.permWrite') }}</option>
            <option value="admin">{{ $t('apiKeys.permAdmin') }}</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="field">
            <label>{{ $t('apiKeys.rateLimitMin') }}</label>
            <input v-model.number="newKey.rateLimitPerMinute" type="number" min="1" />
          </div>
          <div class="field">
            <label>{{ $t('apiKeys.rateLimitHour') }}</label>
            <input v-model.number="newKey.rateLimitPerHour" type="number" min="1" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? $t('apiKeys.generating') : $t('apiKeys.generate') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
