import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, users, type CurrentUser } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<CurrentUser | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  async function loadUser() {
    if (!token.value) return
    try {
      user.value = await users.me()
    } catch {
      // token invalid — clear it
      token.value = null
      localStorage.removeItem('token')
    }
  }

  async function requestOtp(email: string): Promise<void> {
    await auth.requestOtp(email)
  }

  async function verifyOtp(email: string, code: string): Promise<void> {
    const res = await auth.verifyOtp(email, code)
    token.value = res.accessToken
    localStorage.setItem('token', res.accessToken)
    await loadUser()
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  return { token, user, isAuthenticated, loadUser, requestOtp, verifyOtp, logout }
})
