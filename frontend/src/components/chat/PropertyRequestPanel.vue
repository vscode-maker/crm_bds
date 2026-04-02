<template>
  <div class="property-panel d-flex flex-column" style="height: 100%; overflow: hidden; flex-shrink: 0;">
    <!-- Header -->
    <div class="property-header pa-3 d-flex align-center">
      <v-icon size="20" color="orange" class="mr-2">mdi-home-city</v-icon>
      <span class="property-title">Yêu cầu BĐS</span>
      <v-chip v-if="pendingCount > 0" size="x-small" color="orange" variant="flat" class="ml-2">
        {{ pendingCount }}
      </v-chip>
      <v-spacer />
      <v-btn icon size="small" variant="text" @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Content — scrollable -->
    <div class="property-body flex-grow-1" style="overflow-y: auto;">
      <!-- Loading -->
      <div v-if="loading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="orange" size="32" />
      </div>

      <!-- Error -->
      <v-alert v-else-if="error" type="error" variant="tonal" density="compact">
        {{ error }}
      </v-alert>

      <!-- Empty state -->
      <div v-else-if="requests.length === 0" class="text-center py-8">
        <v-icon size="48" color="grey-darken-1">mdi-home-search</v-icon>
        <div class="text-body-2 mt-2" style="color: #94a3b8;">Chưa phát hiện yêu cầu BĐS nào</div>
      </div>

      <!-- Request cards -->
      <div v-else class="request-list">
        <div
          v-for="req in requests"
          :key="req.id"
          class="request-card"
          :class="{ 'request-approved': req.status === 'approved', 'request-rejected': req.status === 'rejected' }"
        >
          <!-- Type chips -->
          <div class="d-flex align-center gap-1 mb-2">
            <v-chip
              size="x-small"
              :color="requestTypeColor(req.requestType)"
              variant="flat"
            >
              {{ requestTypeLabel(req.requestType) }}
            </v-chip>
            <v-chip v-if="req.propertyType" size="x-small" variant="tonal" color="blue-grey">
              {{ req.propertyType }}
            </v-chip>
            <v-spacer />
            <v-chip
              size="x-small"
              :color="statusColor(req.status)"
              variant="outlined"
            >
              {{ statusLabel(req.status) }}
            </v-chip>
          </div>

          <!-- Details -->
          <div v-if="req.location" class="detail-row">
            <v-icon size="14" class="mr-1">mdi-map-marker</v-icon>
            <span>{{ req.location }}</span>
          </div>
          <div v-if="req.area" class="detail-row">
            <v-icon size="14" class="mr-1">mdi-ruler-square</v-icon>
            <span>{{ req.area }}</span>
          </div>
          <div v-if="req.priceRange" class="detail-row">
            <v-icon size="14" class="mr-1">mdi-currency-usd</v-icon>
            <span>{{ req.priceRange }}</span>
          </div>
          <div v-if="req.contactInfo" class="detail-row">
            <v-icon size="14" class="mr-1">mdi-phone</v-icon>
            <span>{{ req.contactInfo }}</span>
          </div>
          <div v-if="req.details" class="detail-row detail-summary mt-1">
            {{ req.details }}
          </div>

          <!-- Sender + time -->
          <div class="detail-row mt-2" style="opacity: 0.6; font-size: 0.75rem;">
            <v-icon size="12" class="mr-1">mdi-account</v-icon>
            {{ req.senderName }} · {{ formatTime(req.createdAt) }}
          </div>

          <!-- Actions for pending -->
          <div v-if="req.status === 'pending'" class="d-flex gap-2 mt-2">
            <v-btn
              size="small" variant="tonal" color="green"
              prepend-icon="mdi-check"
              :loading="reviewingId === req.id"
              @click="reviewRequest(req.id, 'approved')"
            >
              Duyệt
            </v-btn>
            <v-btn
              size="small" variant="tonal" color="red"
              prepend-icon="mdi-close"
              :loading="reviewingId === req.id"
              @click="reviewRequest(req.id, 'rejected')"
            >
              Từ chối
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { api } from '@/api/index';

interface PropertyRequest {
  id: string;
  senderUid: string;
  senderName: string | null;
  requestType: string | null;
  propertyType: string | null;
  location: string | null;
  area: string | null;
  priceRange: string | null;
  contactInfo: string | null;
  details: string | null;
  status: string;
  createdAt: string;
}

const props = defineProps<{
  conversationId: string;
}>();

defineEmits<{ close: [] }>();

const loading = ref(false);
const error = ref('');
const requests = ref<PropertyRequest[]>([]);
const reviewingId = ref('');

const pendingCount = computed(() => requests.value.filter((r) => r.status === 'pending').length);

// Fetch requests when conversationId changes
watch(
  () => props.conversationId,
  (id) => {
    if (id) fetchRequests();
  },
  { immediate: true },
);

async function fetchRequests() {
  if (!props.conversationId) return;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/conversations/${props.conversationId}/property-requests`);
    requests.value = data.data || [];
  } catch {
    error.value = 'Lỗi tải danh sách yêu cầu BĐS';
  } finally {
    loading.value = false;
  }
}

async function reviewRequest(id: string, status: string) {
  reviewingId.value = id;
  try {
    await api.patch(`/property-requests/${id}/review`, { status });
    // Update local state
    const req = requests.value.find((r) => r.id === id);
    if (req) req.status = status;
  } catch {
    error.value = 'Lỗi duyệt yêu cầu';
  } finally {
    reviewingId.value = '';
  }
}

function requestTypeLabel(type: string | null): string {
  const map: Record<string, string> = { mua: 'Cần mua', bán: 'Cần bán', cho_thuê: 'Cho thuê', thuê: 'Cần thuê' };
  return map[type || ''] || 'BĐS';
}

function requestTypeColor(type: string | null): string {
  const map: Record<string, string> = { mua: 'blue', bán: 'green', cho_thuê: 'purple', thuê: 'orange' };
  return map[type || ''] || 'grey';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' };
  return map[status] || 'grey';
}

function formatTime(d: string): string {
  return new Date(d).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
</script>

<style scoped>
.property-panel {
  background: #1a1b23;
  color: #e2e8f0;
  border-left: 1px solid rgba(251, 146, 60, 0.2);
}

.property-header {
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(234, 88, 12, 0.15));
  border-bottom: 1px solid rgba(251, 146, 60, 0.15);
}

.property-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #ffffff;
}

.property-body {
  padding: 12px;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px;
  transition: border-color 0.2s;
}

.request-card:hover {
  border-color: rgba(251, 146, 60, 0.3);
}

.request-approved {
  border-color: rgba(34, 197, 94, 0.3) !important;
  opacity: 0.7;
}

.request-rejected {
  border-color: rgba(239, 68, 68, 0.2) !important;
  opacity: 0.5;
}

.detail-row {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  color: #cbd5e1;
  line-height: 1.4;
}

.detail-summary {
  color: #94a3b8;
  font-style: italic;
}

/* Scrollbar */
.property-body::-webkit-scrollbar { width: 4px; }
.property-body::-webkit-scrollbar-track { background: transparent; }
.property-body::-webkit-scrollbar-thumb { background: rgba(251, 146, 60, 0.3); border-radius: 4px; }
</style>
