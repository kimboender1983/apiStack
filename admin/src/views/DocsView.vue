<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { projects, collections, apiKeys, type Project, type Collection, type ApiKey } from '../api/client'

const route = useRoute()
useI18n()
const projectId = route.params.projectId as string

const project = ref<Project | null>(null)
const collectionList = ref<Collection[]>([])
const keyList = ref<ApiKey[]>([])
const selectedKeyPrefix = ref<string>('')
const loading = ref(true)
const copied = ref<string | null>(null)

const BASE_URL = `${window.location.protocol}//${window.location.hostname}:3000`

onMounted(async () => {
  const [p, cols, keys] = await Promise.all([
    projects.list().then(ps => ps.find(x => x.id === projectId) ?? null),
    collections.list(projectId),
    apiKeys.list(projectId),
  ])
  project.value = p
  collectionList.value = cols
  keyList.value = keys
  if (keys.length) selectedKeyPrefix.value = keys[0]?.keyPrefix ?? ''
  loading.value = false
})

const selectedKey = computed(() =>
  keyList.value.find(k => k.keyPrefix === selectedKeyPrefix.value) ?? null
)

const apiKey = computed(() =>
  selectedKey.value ? `apf_${selectedKey.value.keyPrefix}\u2026` : 'YOUR_API_KEY'
)

function copy(text: string, id: string) {
  navigator.clipboard.writeText(text)
  copied.value = id
  setTimeout(() => { copied.value = null }, 1500)
}

function collectionUrl(slug: string) {
  return `${BASE_URL}/api/${slug}`
}

function generateExampleBody(col: Collection): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of col.fields ?? []) {
    switch (f.type) {
      case 'string':    body[f.name] = ''; break
      case 'text':      body[f.name] = ''; break
      case 'richtext':  body[f.name] = '<p></p>'; break
      case 'integer':   body[f.name] = 0; break
      case 'float':     body[f.name] = 0.0; break
      case 'boolean':   body[f.name] = false; break
      case 'date':      body[f.name] = '2024-01-01'; break
      case 'datetime':  body[f.name] = '2024-01-01T00:00:00Z'; break
      case 'json':      body[f.name] = {}; break
      case 'enum':      body[f.name] = f.enumValues?.[0] ?? ''; break
      case 'file':      body[f.name] = null; break
      default:          body[f.name] = ''
    }
  }
  return body
}

function buildPostmanRequest(
  name: string,
  method: string,
  url: string,
  body?: Record<string, unknown>,
  queryParams?: { key: string; value: string; description: string }[],
) {
  const urlParts = url.replace('{{baseUrl}}/', '').split('/')
  const req: Record<string, unknown> = {
    name,
    request: {
      method,
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
      },
      header: [],
      url: {
        raw: url + (queryParams?.length ? '?' + queryParams.map(p => `${p.key}=${p.value}`).join('&') : ''),
        host: ['{{baseUrl}}'],
        path: urlParts,
        ...(queryParams?.length ? { query: queryParams.map(p => ({ key: p.key, value: p.value, description: p.description })) } : {}),
      },
    },
  }
  if (body && (method === 'POST' || method === 'PUT')) {
    (req.request as any).body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
    (req.request as any).header = [{ key: 'Content-Type', value: 'application/json', type: 'text' }]
  }
  return req
}

function downloadPostmanCollection() {
  const exampleBody = (col: Collection) => generateExampleBody(col)

  const collection = {
    info: {
      name: `${project.value?.name ?? 'APIForge'} API`,
      _postman_id: crypto.randomUUID(),
      description: `Auto-generated collection for project "${project.value?.name}"`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
    },
    variable: [
      { key: 'baseUrl', value: BASE_URL, type: 'string' },
      { key: 'apiKey', value: 'PASTE_YOUR_FULL_API_KEY_HERE', type: 'string' },
    ],
    item: collectionList.value.map(col => ({
      name: col.name,
      item: [
        buildPostmanRequest(
          `List ${col.name}`,
          'GET',
          `{{baseUrl}}/api/${col.slug}`,
          undefined,
          [
            { key: 'filter[field]', value: 'value', description: 'Filter by field value' },
            { key: 'sort', value: '-createdAt', description: 'Sort field, prefix - for descending' },
            { key: 'limit', value: '20', description: 'Page size' },
            { key: 'offset', value: '0', description: 'Page offset' },
          ],
        ),
        buildPostmanRequest(`Get ${col.name} by ID`, 'GET', `{{baseUrl}}/api/${col.slug}/:id`),
        buildPostmanRequest(`Create ${col.name}`, 'POST', `{{baseUrl}}/api/${col.slug}`, exampleBody(col)),
        buildPostmanRequest(`Update ${col.name}`, 'PUT', `{{baseUrl}}/api/${col.slug}/:id`, exampleBody(col)),
        buildPostmanRequest(`Delete ${col.name}`, 'DELETE', `{{baseUrl}}/api/${col.slug}/:id`),
      ],
    })),
  }

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.value?.slug ?? 'apiforge'}-postman-collection.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page" style="max-width:860px">
    <div class="breadcrumb">
      <RouterLink to="/">{{ $t('nav.projects') }}</RouterLink>
      <span>/</span>
      <RouterLink :to="`/projects/${projectId}`">{{ project?.name ?? '\u2026' }}</RouterLink>
      <span>/</span>
      <span class="current">{{ $t('nav.apiDocs') }}</span>
    </div>

    <div class="page-header">
      <h1>{{ $t('docs.title') }}</h1>
      <button class="btn btn-primary" :disabled="loading" @click="downloadPostmanCollection">
        {{ $t('docs.downloadPostman') }}
      </button>
    </div>
    <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:1.5rem">
      {{ $t('docs.postmanHint') }} <code>apiKey</code> {{ $t('docs.postmanHint2') }} <RouterLink :to="`/projects/${projectId}/keys`">{{ $t('nav.apiKeys') }}</RouterLink>.
    </div>

    <div v-if="loading" class="text-muted">{{ $t('common.loading') }}</div>

    <template v-else>

      <!-- Key selector -->
      <div v-if="keyList.length" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:2rem;padding:0.875rem 1rem;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius)">
        <span style="font-size:0.875rem;color:var(--text-muted);white-space:nowrap">{{ $t('docs.showExamplesUsing') }}</span>
        <select v-model="selectedKeyPrefix" style="flex:1;max-width:260px">
          <option v-for="k in keyList" :key="k.id" :value="k.keyPrefix">
            {{ k.name ?? $t('apiKeys.unnamed') }} ({{ k.permissions }})
          </option>
        </select>
        <span class="badge" style="font-family:monospace;font-size:0.8rem">{{ apiKey }}</span>
      </div>
      <div v-else style="margin-bottom:2rem" class="alert alert-error">
        {{ $t('docs.noKeys') }} <RouterLink :to="`/projects/${projectId}/keys`">{{ $t('docs.createFirst') }}</RouterLink>
      </div>

      <!-- ── Authentication ── -->
      <section style="margin-bottom:2.5rem">
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.25rem">{{ $t('docs.authentication') }}</h2>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1.25rem">{{ $t('docs.authDesc') }}</p>

        <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:0.5rem">{{ $t('docs.authHeader') }} <span class="badge badge-green" style="font-size:0.7rem">{{ $t('docs.recommended') }}</span></h3>
        <div class="code-block" style="position:relative">
          <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`Authorization: Bearer ${apiKey}`, 'header')">
            {{ copied === 'header' ? $t('common.copied') : $t('common.copy') }}
          </button>
          <span style="color:var(--text-muted)">Authorization:</span> Bearer {{ apiKey }}
        </div>

        <h3 style="font-size:0.9375rem;font-weight:600;margin:1rem 0 0.5rem">{{ $t('docs.queryParam') }}</h3>
        <div class="code-block" style="position:relative">
          <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`?apiKey=${apiKey}`, 'queryparam')">
            {{ copied === 'queryparam' ? $t('common.copied') : $t('common.copy') }}
          </button>
          GET {{ BASE_URL }}/api/collection<span style="color:var(--accent)">?apiKey={{ apiKey }}</span>
        </div>
      </section>

      <!-- ── Permissions ── -->
      <section style="margin-bottom:2.5rem">
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">{{ $t('docs.permissions') }}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:0.5rem 0.75rem;color:var(--text-muted);font-weight:500">{{ $t('docs.level') }}</th>
              <th style="text-align:left;padding:0.5rem 0.75rem;color:var(--text-muted);font-weight:500">{{ $t('docs.allowed') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:0.5rem 0.75rem"><span class="badge badge-gray">read</span></td>
              <td style="padding:0.5rem 0.75rem;color:var(--text-muted)">{{ $t('docs.readAllowed') }}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:0.5rem 0.75rem"><span class="badge badge-purple">write</span></td>
              <td style="padding:0.5rem 0.75rem;color:var(--text-muted)">{{ $t('docs.writeAllowed') }}</td>
            </tr>
            <tr>
              <td style="padding:0.5rem 0.75rem"><span class="badge badge-red">admin</span></td>
              <td style="padding:0.5rem 0.75rem;color:var(--text-muted)">{{ $t('docs.adminAllowed') }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ── Collections ── -->
      <section style="margin-bottom:2.5rem">
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">{{ $t('docs.endpoints') }}</h2>

        <div v-if="collectionList.length === 0" class="card">
          <div class="card-empty">{{ $t('docs.noCollections') }}</div>
        </div>

        <div v-for="col in collectionList" :key="col.id" style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
            <h3 style="font-size:1rem;font-weight:700;margin:0">{{ col.name }}</h3>
            <span class="badge badge-gray" style="font-family:monospace">/api/{{ col.slug }}</span>
            <span class="badge" :class="col.visibility === 'public' ? 'badge-green' : col.visibility === 'protected' ? 'badge-purple' : 'badge-gray'">{{ col.visibility }}</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <!-- GET list -->
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.875rem;cursor:pointer" @click="copy(`curl ${collectionUrl(col.slug)} -H 'Authorization: Bearer ${apiKey}'`, `get-${col.id}`)">
                <span style="background:#22c55e22;color:#22c55e;font-family:monospace;font-size:0.8rem;padding:0.15rem 0.5rem;border-radius:4px;min-width:52px;text-align:center;font-weight:600">GET</span>
                <code style="font-size:0.8125rem;flex:1">{{ collectionUrl(col.slug) }}</code>
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ copied === `get-${col.id}` ? $t('common.copied') : $t('common.copyCurl') }}</span>
              </div>
            </div>
            <!-- GET single -->
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.875rem;cursor:pointer" @click="copy(`curl ${collectionUrl(col.slug)}/:id -H 'Authorization: Bearer ${apiKey}'`, `get1-${col.id}`)">
                <span style="background:#22c55e22;color:#22c55e;font-family:monospace;font-size:0.8rem;padding:0.15rem 0.5rem;border-radius:4px;min-width:52px;text-align:center;font-weight:600">GET</span>
                <code style="font-size:0.8125rem;flex:1">{{ collectionUrl(col.slug) }}/:id</code>
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ copied === `get1-${col.id}` ? $t('common.copied') : $t('common.copyCurl') }}</span>
              </div>
            </div>
            <!-- POST -->
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.875rem;cursor:pointer" @click="copy(`curl ${collectionUrl(col.slug)} -X POST -H 'Authorization: Bearer ${apiKey}' -H 'Content-Type: application/json' -d '{}'`, `post-${col.id}`)">
                <span style="background:#6c63ff22;color:#6c63ff;font-family:monospace;font-size:0.8rem;padding:0.15rem 0.5rem;border-radius:4px;min-width:52px;text-align:center;font-weight:600">POST</span>
                <code style="font-size:0.8125rem;flex:1">{{ collectionUrl(col.slug) }}</code>
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ copied === `post-${col.id}` ? $t('common.copied') : $t('common.copyCurl') }}</span>
              </div>
            </div>
            <!-- PUT -->
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.875rem;cursor:pointer" @click="copy(`curl ${collectionUrl(col.slug)}/:id -X PUT -H 'Authorization: Bearer ${apiKey}' -H 'Content-Type: application/json' -d '{}'`, `put-${col.id}`)">
                <span style="background:#f59e0b22;color:#f59e0b;font-family:monospace;font-size:0.8rem;padding:0.15rem 0.5rem;border-radius:4px;min-width:52px;text-align:center;font-weight:600">PUT</span>
                <code style="font-size:0.8125rem;flex:1">{{ collectionUrl(col.slug) }}/:id</code>
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ copied === `put-${col.id}` ? $t('common.copied') : $t('common.copyCurl') }}</span>
              </div>
            </div>
            <!-- DELETE -->
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.875rem;cursor:pointer" @click="copy(`curl ${collectionUrl(col.slug)}/:id -X DELETE -H 'Authorization: Bearer ${apiKey}'`, `del-${col.id}`)">
                <span style="background:#ef444422;color:#ef4444;font-family:monospace;font-size:0.8rem;padding:0.15rem 0.5rem;border-radius:4px;min-width:52px;text-align:center;font-weight:600">DELETE</span>
                <code style="font-size:0.8125rem;flex:1">{{ collectionUrl(col.slug) }}/:id</code>
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ copied === `del-${col.id}` ? $t('common.copied') : $t('common.copyCurl') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Filtering & Pagination ── -->
      <section style="margin-bottom:2.5rem">
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">{{ $t('docs.filteringTitle') }}</h2>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div class="code-block" style="position:relative">
            <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`${BASE_URL}/api/{collection}?filter[field]=value`, 'filter')">{{ copied === 'filter' ? $t('common.copied') : $t('common.copy') }}</button>
            <span style="color:var(--text-muted)">{{ $t('docs.filterComment') }}</span>
            {{ BASE_URL }}/api/{collection}?<span style="color:var(--accent)">filter[field]=value</span>
          </div>
          <div class="code-block" style="position:relative">
            <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`${BASE_URL}/api/{collection}?sort=-createdAt`, 'sort')">{{ copied === 'sort' ? $t('common.copied') : $t('common.copy') }}</button>
            <span style="color:var(--text-muted)">{{ $t('docs.sortComment') }}</span>
            {{ BASE_URL }}/api/{collection}?<span style="color:var(--accent)">sort=-createdAt</span>
          </div>
          <div class="code-block" style="position:relative">
            <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`${BASE_URL}/api/{collection}?limit=20&offset=40`, 'page')">{{ copied === 'page' ? $t('common.copied') : $t('common.copy') }}</button>
            <span style="color:var(--text-muted)">{{ $t('docs.pageComment') }}</span>
            {{ BASE_URL }}/api/{collection}?<span style="color:var(--accent)">limit=20&amp;offset=40</span>
          </div>
          <div class="code-block" style="position:relative">
            <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`${BASE_URL}/api/{collection}?include=relation`, 'include')">{{ copied === 'include' ? $t('common.copied') : $t('common.copy') }}</button>
            <span style="color:var(--text-muted)">{{ $t('docs.includeComment') }}</span>
            {{ BASE_URL }}/api/{collection}?<span style="color:var(--accent)">include=relation</span>
          </div>
          <div class="code-block" style="position:relative">
            <button class="btn btn-ghost btn-sm" style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem" @click="copy(`${BASE_URL}/api/{collection}?filter[status]=active&sort=-createdAt&limit=10&offset=0`, 'combined')">{{ copied === 'combined' ? $t('common.copied') : $t('common.copy') }}</button>
            <span style="color:var(--text-muted)">{{ $t('docs.combinedComment') }}</span>
            {{ BASE_URL }}/api/{collection}?<span style="color:var(--accent)">filter[status]=active&amp;sort=-createdAt&amp;limit=10&amp;offset=0</span>
          </div>
        </div>
      </section>

      <!-- ── Response format ── -->
      <section>
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">{{ $t('docs.responseFormat') }}</h2>
        <div class="code-block" style="white-space:pre;line-height:1.6">{{
`// List response
{
  "data": [ { "id": "…", "createdAt": "…", …fields } ],
  "meta": { "total": 42, "limit": 20, "offset": 0 }
}

// Single record
{ "id": "…", "createdAt": "…", "updatedAt": "…", …fields }`
        }}</div>
      </section>

    </template>
  </div>
</template>
