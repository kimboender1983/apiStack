const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (res.status === 204) return undefined as T

  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Request failed')
  return data as T
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  requestOtp: (email: string) =>
    request('/auth/otp/request', { method: 'POST', body: JSON.stringify({ email }) }),

  verifyOtp: (email: string, code: string): Promise<{ accessToken: string }> =>
    request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
}

// ── Current user ──────────────────────────────────────────────────────────────

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: string
}

export const users = {
  me: (): Promise<CurrentUser> => request('/admin/me'),
  updateMe: (data: { name?: string }): Promise<CurrentUser> =>
    request('/admin/me', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadAvatar: async (file: File): Promise<CurrentUser> => {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/admin/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any).message ?? 'Upload failed')
    }
    return res.json()
  },
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface ProjectOwner {
  id: string
  name: string | null
  email: string
}

export interface Project {
  id: string
  userId: string
  name: string
  slug: string
  createdAt: string
  user: ProjectOwner
}

export const projects = {
  list: (): Promise<Project[]> => request('/admin/projects'),
  create: (name: string): Promise<Project> =>
    request('/admin/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (id: string) => request(`/admin/projects/${id}`, { method: 'DELETE' }),
  myRole: (id: string): Promise<{ role: 'owner' | 'editor' | 'viewer' }> =>
    request(`/admin/projects/${id}/my-role`),
}

// ── Collections ───────────────────────────────────────────────────────────────

export interface Collection {
  id: string
  projectId: string
  name: string
  slug: string
  visibility: 'public' | 'protected' | 'private'
  createdAt: string
  fields: Field[]
}

export const collections = {
  list: (projectId: string): Promise<Collection[]> =>
    request(`/admin/projects/${projectId}/collections`),
  create: (projectId: string, name: string, visibility: string): Promise<Collection> =>
    request(`/admin/projects/${projectId}/collections`, {
      method: 'POST',
      body: JSON.stringify({ name, visibility }),
    }),
  delete: (projectId: string, id: string) =>
    request(`/admin/projects/${projectId}/collections/${id}`, { method: 'DELETE' }),
}

// ── Fields ────────────────────────────────────────────────────────────────────

export interface Field {
  id: string
  name: string
  type: string
  required: boolean
  defaultValue: string | null
  enumValues: string[] | null
}

export interface FieldPayload {
  name: string
  type: string
  required: boolean
  defaultValue?: string
  enumValues?: string[]
}

export const fields = {
  list: (projectId: string, collectionId: string): Promise<Field[]> =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/fields`),
  create: (
    projectId: string,
    collectionId: string,
    payload: FieldPayload,
  ): Promise<Field> =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/fields`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    projectId: string,
    collectionId: string,
    id: string,
    payload: Partial<FieldPayload>,
  ): Promise<Field> =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  reorder: (projectId: string, collectionId: string, ids: string[]) =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/fields/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
  delete: (projectId: string, collectionId: string, id: string) =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/fields/${id}`, {
      method: 'DELETE',
    }),
}

// ── Relations ─────────────────────────────────────────────────────────────────

export interface Relation {
  id: string
  fieldName: string
  relationType: string
  targetCollectionId: string
  targetCollection: { id: string; slug: string; name: string } | null
}

export const relations = {
  list: (projectId: string, collectionId: string): Promise<Relation[]> =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/relations`),
  create: (
    projectId: string,
    collectionId: string,
    payload: { fieldName: string; relationType: string; targetCollectionId: string },
  ): Promise<Relation> =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/relations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  delete: (projectId: string, collectionId: string, id: string) =>
    request(`/admin/projects/${projectId}/collections/${collectionId}/relations/${id}`, {
      method: 'DELETE',
    }),
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  keyPrefix: string
  name: string | null
  permissions: string
  rateLimitPerMinute: number
  rateLimitPerHour: number
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface CreatedApiKey {
  apiKey: string
  record: ApiKey
}

export const apiKeys = {
  list: (projectId: string): Promise<ApiKey[]> =>
    request(`/admin/projects/${projectId}/api-keys`),
  create: (
    projectId: string,
    payload: { name: string; permissions: string; rateLimitPerMinute?: number; rateLimitPerHour?: number },
  ): Promise<CreatedApiKey> =>
    request(`/admin/projects/${projectId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  delete: (projectId: string, id: string) =>
    request(`/admin/projects/${projectId}/api-keys/${id}`, { method: 'DELETE' }),
}

// ── Files (media library) ─────────────────────────────────────────────────────

export interface StoredFile {
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
}

export interface MediaFile {
  id: string
  projectId: string | null
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  name: string
  title: string
  alt: string
  copyright: string
  focus: string
  metaData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

async function uploadToEndpoint(endpoint: string, file: File): Promise<MediaFile> {
  const token = localStorage.getItem('token')
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).message ?? 'Upload failed')
  }
  return res.json()
}

export const files = {
  listGlobal: (): Promise<MediaFile[]> =>
    request('/admin/files'),
  listForProject: (projectId: string): Promise<MediaFile[]> =>
    request(`/admin/projects/${projectId}/files`),
  uploadGlobal: (file: File): Promise<MediaFile> =>
    uploadToEndpoint('/admin/files/upload', file),
  uploadToProject: (projectId: string, file: File): Promise<MediaFile> =>
    uploadToEndpoint(`/admin/projects/${projectId}/files/upload`, file),
  update: (id: string, data: {
    name?: string; title?: string; alt?: string;
    copyright?: string; focus?: string; metaData?: Record<string, unknown>
  }): Promise<MediaFile> =>
    request(`/admin/files/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/admin/files/${id}`, { method: 'DELETE' }),
}

/** @deprecated use files.uploadToProject instead */
export async function uploadFile(projectId: string, file: File): Promise<StoredFile> {
  return files.uploadToProject(projectId, file)
}

// ── Members ───────────────────────────────────────────────────────────────────

export interface Member {
  id: string
  projectId: string
  userId: string
  role: 'editor' | 'viewer'
  createdAt: string
  user: { id: string; email: string }
}

export interface Invitation {
  id: string
  projectId: string
  email: string
  role: string
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export interface InvitationInfo {
  id: string
  projectId: string
  email: string
  role: string
  expiresAt: string
  project: { id: string; name: string }
}

export const members = {
  list: (projectId: string): Promise<{ members: Member[]; invitations: Invitation[] }> =>
    request(`/admin/projects/${projectId}/members`),
  invite: (projectId: string, email: string, role: string): Promise<Invitation> =>
    request(`/admin/projects/${projectId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  updateRole: (projectId: string, memberId: string, role: string): Promise<Member> =>
    request(`/admin/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  remove: (projectId: string, memberId: string) =>
    request(`/admin/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
  cancelInvitation: (projectId: string, invitationId: string) =>
    request(`/admin/projects/${projectId}/members/invitations/${invitationId}`, {
      method: 'DELETE',
    }),
  getInvitation: (token: string): Promise<InvitationInfo> =>
    request(`/invitations/${token}`),
  acceptInvitation: (token: string): Promise<{ projectId: string }> =>
    request('/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }),
}

// ── Workspace Team ────────────────────────────────────────────────────────────

export interface TeamMembership {
  id: string
  projectId: string
  projectName: string
  role: string
}

export interface TeamMember {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null }
  memberships: TeamMembership[]
}

export interface TeamInvitationProject {
  invitationId: string
  projectId: string
  projectName: string
  role: string
  expiresAt: string
}

export interface TeamInvitation {
  email: string
  projects: TeamInvitationProject[]
}

export interface WorkspaceTeam {
  projects: { id: string; name: string }[]
  members: TeamMember[]
  invitations: TeamInvitation[]
}

export const team = {
  get: (): Promise<WorkspaceTeam> => request('/admin/team'),
  invite: (
    email: string,
    assignments: { projectId: string; role: string }[],
  ): Promise<{ invitations: any[]; errors: any[] }> =>
    request('/admin/team/invite', {
      method: 'POST',
      body: JSON.stringify({ email, assignments }),
    }),
}

// ── Records (admin) ───────────────────────────────────────────────────────────

export interface Record {
  id: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface RecordList {
  data: Record[]
  meta: { total: number; limit: number; offset: number }
}

export const records = {
  list: (projectId: string, collectionSlug: string, params?: Record<string, string>): Promise<RecordList> => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/admin/projects/${projectId}/collections/${collectionSlug}/records${qs}`)
  },
  create: (projectId: string, collectionSlug: string, data: Record<string, unknown>): Promise<Record> =>
    request(`/admin/projects/${projectId}/collections/${collectionSlug}/records`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (projectId: string, collectionSlug: string, id: string, data: Record<string, unknown>): Promise<Record> =>
    request(`/admin/projects/${projectId}/collections/${collectionSlug}/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (projectId: string, collectionSlug: string, id: string) =>
    request(`/admin/projects/${projectId}/collections/${collectionSlug}/records/${id}`, {
      method: 'DELETE',
    }),
}
