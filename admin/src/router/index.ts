import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
    { path: '/', component: () => import('../views/ProjectsView.vue') },
    { path: '/team', component: () => import('../views/TeamView.vue') },
    { path: '/profile', component: () => import('../views/ProfileView.vue') },
    { path: '/projects/:projectId', component: () => import('../views/CollectionsView.vue') },
    {
      path: '/projects/:projectId/collections/:collectionId',
      component: () => import('../views/CollectionDetailView.vue'),
    },
    { path: '/projects/:projectId/keys', component: () => import('../views/ApiKeysView.vue') },
    { path: '/projects/:projectId/files', component: () => import('../views/FilesView.vue') },
    { path: '/projects/:projectId/docs', component: () => import('../views/DocsView.vue') },
    { path: '/projects/:projectId/members', component: () => import('../views/MembersView.vue') },
    {
      path: '/invitations/accept',
      component: () => import('../views/AcceptInvitationView.vue'),
      meta: { public: true },
    },
    {
      path: '/projects/:projectId/collections/:collectionId/data',
      component: () => import('../views/DataView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return '/login'
  }
})

export default router
