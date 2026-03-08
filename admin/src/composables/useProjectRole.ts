import { ref } from 'vue'
import { projects } from '../api/client'

type Role = 'owner' | 'editor' | 'viewer'

const cache = new Map<string, Role>()

export function useProjectRole(projectId: string) {
  const role = ref<Role | null>(cache.get(projectId) ?? null)
  const loading = ref(!cache.has(projectId))

  if (!cache.has(projectId)) {
    projects.myRole(projectId).then(res => {
      cache.set(projectId, res.role)
      role.value = res.role
      loading.value = false
    }).catch(() => {
      loading.value = false
    })
  }

  const isOwner = () => role.value === 'owner'
  const canEdit = () => role.value === 'owner' || role.value === 'editor'

  return { role, loading, isOwner, canEdit }
}
