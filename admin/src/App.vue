<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useTheme } from './composables/useTheme'
import { projects } from './api/client'
import UserAvatar from './components/UserAvatar.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { preference, setTheme, LABELS, ICONS } = useTheme()

const isPublic = computed(() => route.meta.public)
const projectId = computed(() => route.params.projectId as string | undefined)

const projectName = ref<string | null>(null)
const projectIsOwner = ref(false)

watch(projectId, async (id) => {
  if (!id) {
    projectName.value = null
    projectIsOwner.value = false
    return
  }
  try {
    const [list, roleRes] = await Promise.all([projects.list(), projects.myRole(id)])
    projectName.value = list.find(p => p.id === id)?.name ?? null
    projectIsOwner.value = roleRes.role === 'owner'
  } catch {
    projectName.value = null
  }
}, { immediate: true })

onMounted(() => {
  if (auth.isAuthenticated && !auth.user) auth.loadUser()
})

const displayName = computed(() => auth.user?.name || auth.user?.email || '')

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div v-if="isPublic">
    <RouterView />
  </div>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="sidebar-logo">⚡ APIForge</div>
      <RouterLink to="/">Projects</RouterLink>
      <RouterLink to="/team">Team</RouterLink>

      <!-- Project contextual nav -->
      <template v-if="projectId && projectName">
        <div class="sidebar-section-label">{{ projectName }}</div>
        <RouterLink :to="`/projects/${projectId}`" :class="{ 'router-link-active': route.path === `/projects/${projectId}` }">
          Collections
        </RouterLink>
        <RouterLink :to="`/projects/${projectId}/files`">Files</RouterLink>
        <RouterLink :to="`/projects/${projectId}/docs`">API Docs</RouterLink>
        <RouterLink v-if="projectIsOwner" :to="`/projects/${projectId}/keys`">API Keys</RouterLink>
        <RouterLink v-if="projectIsOwner" :to="`/projects/${projectId}/members`">Team</RouterLink>
      </template>

      <div class="sidebar-bottom">
        <RouterLink to="/profile" class="user-card" style="text-decoration:none">
          <UserAvatar
            :avatarUrl="auth.user?.avatarUrl"
            :name="auth.user?.name"
            :email="auth.user?.email"
            :size="32"
          />
          <div class="user-info" style="flex:1;min-width:0">
            <div class="user-name">{{ displayName }}</div>
            <div v-if="auth.user?.name" class="user-email">{{ auth.user.email }}</div>
          </div>
        </RouterLink>

        <div class="theme-switcher">
          <button
            v-for="opt in (['system', 'light', 'dark'] as const)"
            :key="opt"
            class="theme-option"
            :class="{ active: preference === opt }"
            :title="LABELS[opt]"
            @click="setTheme(opt)"
          >
            <span>{{ ICONS[opt] }}</span>
          </button>
        </div>
        <button class="btn btn-ghost" style="width:100%" @click="logout">Logout</button>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
