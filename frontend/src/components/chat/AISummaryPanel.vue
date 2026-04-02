<template>
  <div class="ai-summary-panel d-flex flex-column" style="height: 100%; overflow: hidden; flex-shrink: 0;">
    <!-- Header -->
    <div class="ai-panel-header pa-3 d-flex align-center">
      <v-icon size="20" color="purple-lighten-2" class="mr-2">mdi-creation</v-icon>
      <span class="font-weight-medium ai-panel-title">AI Summary</span>
      <v-spacer />
      <v-chip v-if="cached && !loading" size="x-small" color="info" variant="tonal" class="mr-1">
        <v-icon size="10" start>mdi-cached</v-icon>
        Cached
      </v-chip>
      <v-btn icon size="small" variant="text" @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Content area — scrollable -->
    <div class="ai-panel-body flex-grow-1" style="overflow-y: auto;">
      <!-- Loading shimmer skeleton -->
      <div v-if="loading" class="ai-skeleton">
        <div class="skeleton-group" v-for="i in 3" :key="i">
          <div class="skeleton-icon" />
          <div class="skeleton-lines">
            <div class="skeleton-line" :style="{ width: '90%' }" />
            <div class="skeleton-line" :style="{ width: [65, 75, 55][i - 1] + '%' }" />
          </div>
        </div>
      </div>

      <!-- Error state -->
      <v-alert v-else-if="error" type="error" variant="tonal" density="compact" class="mb-0">
        <div class="text-body-2">{{ error }}</div>
      </v-alert>

      <!-- Summary result -->
      <div v-else-if="displayedText" class="ai-content" v-html="renderedHtml" />

      <!-- Empty state -->
      <div v-else class="ai-empty text-center py-8">
        <v-icon size="40" color="grey-darken-1">mdi-chat-processing-outline</v-icon>
        <div class="text-body-2 text-grey mt-2">Đang chờ tóm tắt...</div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="ai-panel-footer d-flex align-center pa-3">
      <v-btn
        size="small"
        variant="tonal"
        color="grey"
        prepend-icon="mdi-content-copy"
        :disabled="!summaryText || loading"
        @click="copyToClipboard"
      >
        {{ copyLabel }}
      </v-btn>
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        color="purple"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="fetchSummary(true)"
      >
        Làm mới
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{
  conversationId: string;
}>();

defineEmits<{ close: [] }>();

const loading = ref(false);
const error = ref('');
const summaryText = ref('');
const displayedText = ref('');
const cached = ref(false);
const copyLabel = ref('Sao chép');

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let lastFetchedConvId = '';

// Rendered HTML: **bold** → <strong>, newlines → <br>
const renderedHtml = computed(() => {
  return displayedText.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
});

// Auto-fetch when conversationId changes
watch(
  () => props.conversationId,
  (convId) => {
    if (convId && convId !== lastFetchedConvId) {
      lastFetchedConvId = convId;
      summaryText.value = '';
      displayedText.value = '';
      error.value = '';
      cached.value = false;
      stopTyping();
      fetchSummary(false);
    }
  },
  { immediate: true },
);

async function fetchSummary(force: boolean) {
  if (!props.conversationId) return;

  loading.value = true;
  error.value = '';
  displayedText.value = '';
  stopTyping();

  try {
    const { data } = await api.get(
      `/conversations/${props.conversationId}/summary`,
      { params: force ? { force: 'true' } : {} },
    );
    summaryText.value = data.summary;
    cached.value = data.cached;
    startTypingEffect(data.summary);
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Lỗi khi gọi AI. Vui lòng thử lại sau.';
  } finally {
    loading.value = false;
  }
}

function startTypingEffect(text: string) {
  stopTyping();
  let index = 0;
  displayedText.value = '';

  function typeNext() {
    if (index < text.length) {
      const chunk = text.slice(index, index + 3);
      displayedText.value += chunk;
      index += 3;
      typingTimer = setTimeout(typeNext, 12);
    }
  }
  typeNext();
}

function stopTyping() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
}

async function copyToClipboard() {
  if (!summaryText.value) return;
  try {
    await navigator.clipboard.writeText(summaryText.value);
    copyLabel.value = 'Đã sao chép!';
    setTimeout(() => { copyLabel.value = 'Sao chép'; }, 2000);
  } catch {
    copyLabel.value = 'Lỗi copy';
    setTimeout(() => { copyLabel.value = 'Sao chép'; }, 2000);
  }
}
</script>

<style scoped>
.ai-summary-panel {
  background: #1a1b23;
  color: #e2e8f0;
  border-left: 1px solid rgba(102, 126, 234, 0.2);
}

.ai-panel-header {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  border-bottom: 1px solid rgba(102, 126, 234, 0.15);
}

.ai-panel-title {
  color: #ffffff;
  font-size: 0.9rem;
  letter-spacing: 0.3px;
}

.ai-panel-body {
  padding: 16px;
  color: #e2e8f0;
  line-height: 1.75;
  font-size: 0.85rem;
}

.ai-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
}

.ai-content :deep(strong) {
  color: #ffffff;
  font-weight: 700;
}

/* Skeleton */
.ai-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-group {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.skeleton-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.ai-panel-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.6;
}

/* Scrollbar */
.ai-panel-body::-webkit-scrollbar {
  width: 4px;
}
.ai-panel-body::-webkit-scrollbar-track {
  background: transparent;
}
.ai-panel-body::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 4px;
}
</style>
