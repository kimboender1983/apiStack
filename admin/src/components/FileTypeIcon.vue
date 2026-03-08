<script setup lang="ts">
defineProps<{ mimeType: string; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 40"
    :height="size ?? 40"
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- PDF -->
    <template v-if="mimeType === 'application/pdf'">
      <rect width="40" height="40" rx="6" fill="#ef444422"/>
      <path d="M11 8h12l6 6v18a1 1 0 01-1 1H12a1 1 0 01-1-1V9a1 1 0 011-1z" fill="#ef4444" opacity=".25"/>
      <path d="M23 8l6 6h-5a1 1 0 01-1-1V8z" fill="#ef4444" opacity=".5"/>
      <text x="20" y="28" text-anchor="middle" font-size="8" font-weight="700" font-family="monospace" fill="#ef4444">PDF</text>
    </template>

    <!-- Video -->
    <template v-else-if="mimeType.startsWith('video/')">
      <rect width="40" height="40" rx="6" fill="#8b5cf622"/>
      <rect x="8" y="12" width="24" height="16" rx="2" fill="#8b5cf6" opacity=".3"/>
      <path d="M17 15l10 5-10 5V15z" fill="#8b5cf6"/>
    </template>

    <!-- Audio -->
    <template v-else-if="mimeType.startsWith('audio/')">
      <rect width="40" height="40" rx="6" fill="#ec489922"/>
      <circle cx="14" cy="26" r="4" fill="#ec4899" opacity=".4"/>
      <circle cx="26" cy="24" r="4" fill="#ec4899" opacity=".4"/>
      <path d="M18 26V14l12-2v12" stroke="#ec4899" stroke-width="2" fill="none"/>
    </template>

    <!-- JSON -->
    <template v-else-if="mimeType === 'application/json'">
      <rect width="40" height="40" rx="6" fill="#22c55e22"/>
      <text x="20" y="24" text-anchor="middle" font-size="13" font-weight="700" font-family="monospace" fill="#22c55e">{ }</text>
    </template>

    <!-- ZIP / archive -->
    <template v-else-if="mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed' || mimeType === 'application/x-rar-compressed' || mimeType === 'application/x-7z-compressed'">
      <rect width="40" height="40" rx="6" fill="#f59e0b22"/>
      <rect x="12" y="10" width="16" height="20" rx="2" fill="#f59e0b" opacity=".25"/>
      <rect x="17" y="10" width="6" height="3" rx="1" fill="#f59e0b" opacity=".7"/>
      <rect x="17" y="15" width="6" height="3" rx="1" fill="#f59e0b" opacity=".5"/>
      <rect x="17" y="20" width="6" height="3" rx="1" fill="#f59e0b" opacity=".3"/>
      <path d="M20 24v4M17 28h6" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Word / text document -->
    <template v-else-if="mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'text/plain'">
      <rect width="40" height="40" rx="6" fill="#3b82f622"/>
      <path d="M11 8h12l6 6v18a1 1 0 01-1 1H12a1 1 0 01-1-1V9a1 1 0 011-1z" fill="#3b82f6" opacity=".2"/>
      <path d="M23 8l6 6h-5a1 1 0 01-1-1V8z" fill="#3b82f6" opacity=".4"/>
      <path d="M15 20h10M15 23h10M15 26h7" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Spreadsheet -->
    <template v-else-if="mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'text/csv'">
      <rect width="40" height="40" rx="6" fill="#10b98122"/>
      <rect x="11" y="13" width="18" height="14" rx="1" fill="#10b981" opacity=".2"/>
      <path d="M11 18h18M11 23h18M20 13v14" stroke="#10b981" stroke-width="1.2"/>
    </template>

    <!-- SVG -->
    <template v-else-if="mimeType === 'image/svg+xml'">
      <rect width="40" height="40" rx="6" fill="#6366f122"/>
      <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="700" font-family="monospace" fill="#6366f1">SVG</text>
    </template>

    <!-- Generic fallback -->
    <template v-else>
      <rect width="40" height="40" rx="6" fill="#6b728022"/>
      <path d="M11 8h12l6 6v18a1 1 0 01-1 1H12a1 1 0 01-1-1V9a1 1 0 011-1z" fill="#6b7280" opacity=".25"/>
      <path d="M23 8l6 6h-5a1 1 0 01-1-1V8z" fill="#6b7280" opacity=".5"/>
    </template>
  </svg>
</template>
