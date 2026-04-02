<template>
  <v-dialog v-model="dialogVisible" max-width="520" content-class="ai-summary-dialog-wrapper">
    <v-card class="ai-card" elevation="0" theme="dark" style="background: #1a1b23 !important; color: #e2e8f0 !important;">
      <!-- Header with gradient -->
      <div class="ai-header">
        <v-icon size="22" color="purple-lighten-2">mdi-creation</v-icon>
        <span class="ai-title">AI Summary</span>
        <v-spacer />
        <v-chip v-if="cached && !loading" size="x-small" color="info" variant="tonal" class="mr-2">
          <v-icon size="10" start>mdi-cached</v-icon>
          Cached
        </v-chip>
        <v-btn icon="mdi-close" size="x-small" variant="text" color="grey-lighten-1" @click="dialogVisible = false" />
      </div>

      <!-- Content area -->
      <div class="ai-body">
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
        <div v-else class="ai-empty text-center py-4">
          <v-icon size="48" color="grey-darken-1">mdi-chat-processing-outline</v-icon>
          <div class="text-body-2 text-grey mt-2">Nhấn nút bên dưới để AI tóm tắt hội thoại</div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="ai-actions">
        <v-btn
          size="small"
          variant="tonal"
          color="grey-lighten-1"
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
          color="purple-lighten-2"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="fetchSummary(true)"
        >
          Làm mới
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { api } from '@/api/index';

const props = defineProps<{
  conversationId: string;
}>();

const dialogVisible = defineModel<boolean>({ default: false });

const loading = ref(false);
const error = ref('');
const summaryText = ref('');
const displayedText = ref('');
const cached = ref(false);
const copyLabel = ref('Sao chép');

let typingTimer: ReturnType<typeof setTimeout> | null = null;

// Rendered HTML: convert **bold** markdown to <strong> tags and newlines to <br>
const renderedHtml = computed(() => {
  return displayedText.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
});

// Auto-fetch when dialog opens
watch(
  [dialogVisible, () => props.conversationId],
  ([visible, convId]) => {
    if (visible && convId) {
      // Only auto-fetch if we don't have a cached result for this conversation
      if (!summaryText.value) {
        fetchSummary(false);
      }
    }
  },
);

// Reset on conversation change
watch(
  () => props.conversationId,
  () => {
    summaryText.value = '';
    displayedText.value = '';
    error.value = '';
    cached.value = false;
    stopTyping();
  },
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
      // Type multiple chars at once for speed (3 chars per tick)
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
.ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.25), rgba(118, 75, 162, 0.25));
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
}

.ai-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #ffffff;
  letter-spacing: 0.3px;
}

.ai-body {
  padding: 20px;
  min-height: 140px;
  max-height: 400px;
  overflow-y: auto;
  color: #e2e8f0 !important;
  line-height: 1.75;
  font-size: 0.88rem;
}

.ai-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0 !important;
}

.ai-content :deep(strong) {
  color: #ffffff !important;
  font-weight: 700;
}

/* Skeleton shimmer groups */
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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.08) 75%);
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
  height: 13px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08) 25%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.08) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.ai-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.7;
}

/* Scrollbar styling for the body */
.ai-body::-webkit-scrollbar {
  width: 4px;
}

.ai-body::-webkit-scrollbar-track {
  background: transparent;
}

.ai-body::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 4px;
}
</style>

<!-- Global styles to override Vuetify surface color -->
<style>
.ai-card.v-card {
  background: #1a1b23 !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(102, 126, 234, 0.3) !important;
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(102, 126, 234, 0.12) inset !important;
  color: #e2e8f0 !important;
}
</style>
