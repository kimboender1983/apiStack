<script setup lang="ts">
defineProps<{
  avatarUrl?: string | null
  name?: string | null
  email?: string | null
  size?: number
}>()
</script>

<template>
  <div
    class="user-avatar-wrap"
    :style="`width:${size ?? 32}px;height:${size ?? 32}px`"
  >
    <img
      v-if="avatarUrl"
      :src="avatarUrl.startsWith('http') ? avatarUrl : `http://localhost:3000${avatarUrl}`"
      alt="Profile picture"
      class="user-avatar-img"
    />
    <!-- Silhouette SVG with initials overlay if no avatar -->
    <svg v-else viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="var(--accent)" opacity="0.2"/>
      <circle cx="20" cy="15" r="7" fill="var(--accent)" opacity="0.7"/>
      <path d="M4 38c0-8.837 7.163-12 16-12s16 3.163 16 12" fill="var(--accent)" opacity="0.7"/>
    </svg>
  </div>
</template>

<style scoped>
.user-avatar-wrap {
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
}
.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
