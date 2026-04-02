<template>
  <div class="h-100 d-flex flex-column" style="overflow-x: hidden;">
    <!-- Toolbar -->
    <div class="d-flex align-center mb-4 flex-wrap gap-2 flex-shrink-0">
      <h1 class="text-h5 mr-4 font-weight-bold d-flex align-center">
        <v-icon color="primary" class="mr-2">mdi-view-kanban</v-icon>
        Lịch hẹn dạng Bảng
      </h1>
      <v-spacer />
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" class="rounded-pill text-none px-4" @click="showCreateDialog = true">
        Tạo lịch hẹn
      </v-btn>
    </div>

    <!-- Filter (Lấy mượn logic cũ) -->
    <div class="mb-2 d-flex align-center gap-2">
      <v-select
        v-model="filters.status"
        :items="APPOINTMENT_STATUS_OPTIONS"
        item-title="text"
        item-value="value"
        label="Lọc trạng thái"
        variant="outlined"
        density="compact"
        clearable
        style="max-width: 250px"
        hide-details
        @update:model-value="fetchAppointments()"
      />
      <v-btn icon="mdi-refresh" variant="text" size="small" @click="fetchAppointments" title="Làm mới bảng" />
    </div>

    <!-- KANBAN BOARD CONTAINER -->
    <div class="kanban-wrapper mt-2">
      <div class="kanban-container">
        
        <!-- Cột 1: Sắp tới -->
        <div class="kanban-col board-col-scheduled">
          <div class="kanban-col-header text-blue-darken-2">
            <v-icon start size="small">mdi-calendar-clock</v-icon>
            <span class="font-weight-bold text-uppercase">Sắp tới</span>
            <v-chip size="x-small" color="blue" variant="flat" class="ml-2 font-weight-bold">{{ listScheduled.length }}</v-chip>
          </div>
          
          <draggable
            v-model="listScheduled"
            group="appointments"
            item-key="id"
            class="kanban-col-body"
            ghost-class="ghost-card"
            :animation="200"
            :delay="200"
            :delay-on-touch-only="true"
            @change="(e: any) => onDragChange(e, 'scheduled')"
          >
            <template #item="{ element }">
              <v-card class="kanban-card mb-3 pa-3 cursor-grab" elevation="1" border>
                <div class="d-flex justify-space-between align-start mb-1">
                  <div class="text-caption font-weight-bold bg-blue-lighten-5 text-blue px-2 py-1 rounded" style="display:inline-flex; align-items:center;">
                    <v-icon size="x-small" class="mr-1">mdi-clock-outline</v-icon>
                    {{ formatDate(element.appointmentDate) }} {{ element.appointmentTime || '' }}
                  </div>
                  <v-btn icon="mdi-close" size="x-small" variant="text" color="grey" @click="onDelete(element.id)" title="Xoá thẻ"></v-btn>
                </div>
                
                <div class="text-subtitle-2 font-weight-bold mt-2">
                  {{ element.contact?.fullName ?? 'Khách lẻ' }}
                </div>
                <div class="text-caption text-grey-darken-1 mb-2">
                  <v-icon size="x-small" class="mr-1">mdi-phone</v-icon>{{ element.contact?.phone ?? '—' }}
                </div>
                
                <v-chip size="x-small" variant="tonal" color="primary" class="mb-2">
                  {{ typeLabel(element.type) }}
                </v-chip>
                
                <div class="text-caption text-grey-darken-1 line-clamp-2" v-if="element.notes" style="font-style: italic;">
                  "{{ element.notes }}"
                </div>
              </v-card>
            </template>
          </draggable>
        </div>

        <!-- Cột 2: Hoàn thành -->
        <div class="kanban-col board-col-completed">
          <div class="kanban-col-header text-green-darken-1">
            <v-icon start size="small">mdi-check-circle</v-icon>
            <span class="font-weight-bold text-uppercase">Hoàn thành</span>
            <v-chip size="x-small" color="green" variant="flat" class="ml-2 font-weight-bold">{{ listCompleted.length }}</v-chip>
          </div>

          <draggable
            v-model="listCompleted"
            group="appointments"
            item-key="id"
            class="kanban-col-body"
            ghost-class="ghost-card"
            :animation="200"
            :delay="200"
            :delay-on-touch-only="true"
            @change="(e: any) => onDragChange(e, 'completed')"
          >
            <template #item="{ element }">
              <v-card class="kanban-card mb-3 pa-3 cursor-grab opacity-80" elevation="1" border>
                <div class="d-flex justify-space-between align-start mb-1">
                  <div class="text-caption font-weight-bold bg-green-lighten-5 text-green px-2 py-1 rounded" style="display:inline-flex; align-items:center;">
                    <v-icon size="x-small" class="mr-1">mdi-checkbox-marked-circle-outline</v-icon>
                    {{ formatDate(element.appointmentDate) }}
                  </div>
                  <v-btn icon="mdi-close" size="x-small" variant="text" color="grey" @click="onDelete(element.id)" title="Xoá thẻ"></v-btn>
                </div>
                
                <div class="text-subtitle-2 font-weight-bold mt-2 text-decoration-line-through text-grey">
                  {{ element.contact?.fullName ?? 'Khách lẻ' }}
                </div>
                <v-chip size="x-small" variant="tonal" color="green" class="mb-2 mt-1">
                  {{ typeLabel(element.type) }}
                </v-chip>
              </v-card>
            </template>
          </draggable>
        </div>

        <!-- Cột 3: Đã huỷ / No Show -->
        <div class="kanban-col board-col-cancelled">
          <div class="kanban-col-header text-grey-darken-1">
            <v-icon start size="small">mdi-cancel</v-icon>
            <span class="font-weight-bold text-uppercase">Đã huỷ</span>
            <v-chip size="x-small" color="grey" variant="flat" class="ml-2 font-weight-bold">{{ listCancelled.length }}</v-chip>
          </div>

          <draggable
            v-model="listCancelled"
            group="appointments"
            item-key="id"
            class="kanban-col-body"
            ghost-class="ghost-card"
            :animation="200"
            :delay="200"
            :delay-on-touch-only="true"
            @change="(e: any) => onDragChange(e, 'cancelled')"
          >
            <template #item="{ element }">
              <v-card class="kanban-card mb-3 pa-3 cursor-grab opacity-60" elevation="0" variant="outlined" style="border-style: dashed;">
                <div class="d-flex justify-space-between align-start mb-1">
                  <div class="text-caption font-weight-bold text-grey px-2 py-1 rounded" style="display:inline-flex; align-items:center; background: rgba(0,0,0,0.05);">
                    <v-icon size="x-small" class="mr-1">mdi-close-circle-outline</v-icon>
                    {{ formatDate(element.appointmentDate) }}
                  </div>
                  <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="onDelete(element.id)" title="Xóa thẻ"></v-btn>
                </div>
                <div class="text-subtitle-2 font-weight-bold mt-2 text-grey">
                  {{ element.contact?.fullName ?? 'Khách lẻ' }}
                </div>
              </v-card>
            </template>
          </draggable>
        </div>

      </div>
    </div> <!-- END KANBAN WRAPPER -->

    <!-- Create appointment dialog -->
    <v-dialog v-model="showCreateDialog" max-width="520" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          Tạo lịch hẹn mới
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="showCreateDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="createForm.contactId"
                label="ID khách hàng (Tùy chọn)"
                hint="Nhập ID khách hàng hệ thống nếu có"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="createForm.appointmentDate" label="Ngày hẹn *" type="date" required />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="createForm.appointmentTime" label="Giờ hẹn" type="time" />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="createForm.type"
                :items="APPOINTMENT_TYPE_OPTIONS"
                item-title="text"
                item-value="value"
                label="Mục đích khám / Loại hẹn"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="createForm.notes" label="Ghi chú chi tiết" rows="2" auto-grow />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">Huỷ</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="onCreateSave">Lưu Lịch Hẹn</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import draggable from 'vuedraggable';

import {
  useAppointments,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
} from '@/composables/use-appointments';
import type { Appointment } from '@/composables/use-appointments';

const {
  appointments,
  loading, saving, filters,
  fetchAppointments,
  createAppointment, updateAppointment, deleteAppointment,
} = useAppointments();

const showCreateDialog = ref(false);

interface CreateForm {
  contactId: string;
  appointmentDate: string;
  appointmentTime: string;
  type: string;
  notes: string;
}

const createForm = ref<CreateForm>({
  contactId: '',
  appointmentDate: '',
  appointmentTime: '',
  type: 'follow_up',
  notes: '',
});

// Kanban Local Lists
const listScheduled = ref<Appointment[]>([]);
const listCompleted = ref<Appointment[]>([]);
const listCancelled = ref<Appointment[]>([]);

// Sync from backend's single source of truth to Local vuedraggable lists
watch(() => appointments.value, (newVal) => {
  listScheduled.value = newVal.filter(a => a.status === 'scheduled');
  listCompleted.value = newVal.filter(a => a.status === 'completed');
  // Combine no_show and cancelled to the last column
  listCancelled.value = newVal.filter(a => a.status === 'cancelled' || a.status === 'no_show');
}, { deep: true, immediate: true });

// Util Formatters
function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('vi-VN');
}

function typeLabel(type: string) {
  return APPOINTMENT_TYPE_OPTIONS.find(o => o.value === type)?.text ?? type;
}

// Kanban API Handlers
async function onDelete(id: string) {
  if (confirm('Bạn có chắc xoá lịch hẹn này?')) {
    await deleteAppointment(id);
    fetchAppointments(); // Refresh
  }
}

async function onCreateSave() {
  if (!createForm.value.appointmentDate) return alert('Vui lòng chọn ngày hẹn');
  const result = await createAppointment({
    contactId: createForm.value.contactId || undefined,
    appointmentDate: createForm.value.appointmentDate,
    appointmentTime: createForm.value.appointmentTime,
    type: createForm.value.type,
    notes: createForm.value.notes || null,
  } as Partial<Appointment>);
  if (result) {
    showCreateDialog.value = false;
    createForm.value = { contactId: '', appointmentDate: '', appointmentTime: '', type: 'follow_up', notes: '' };
    fetchAppointments();
  }
}

// Fired when dragging is completed to a new column
async function onDragChange(event: any, newStatus: string) {
  if (event.added) {
    const item = event.added.element as Appointment;
    if (item.status !== newStatus) {
      // Update local optimistically
      item.status = newStatus;
      // Emit to server
      const success = await updateAppointment(item.id, { status: newStatus });
      if (!success) {
        // Fallback or rollback on error if necessary
        fetchAppointments();
      }
    }
  }
}

onMounted(() => {
  // Fetch all appointments (clear past limitations of today-only on initial view)
  fetchAppointments();
});
</script>

<style scoped>
/* MOBILE FIRST KANBAN SCROLLING LAYER */
.kanban-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 24px; /* for invisible scrollbar space */
  scrollbar-width: none; /* Hide scrollbar Firefox */
  -ms-overflow-style: none; /* Hide scrollbar IE */
}
.kanban-wrapper::-webkit-scrollbar {
  display: none; /* Hide scrollbar Webkit */
}

.kanban-container {
  display: flex;
  gap: 16px;
  width: max-content;
  min-height: calc(100vh - 200px); /* Fill most page */
  padding-right: 24px; /* Snap ending buffer */
  scroll-snap-type: x mandatory;
  scroll-padding: 0 16px; /* For snap align edge */
}

.kanban-col {
  flex: 0 0 320px;
  width: 320px;
  background: rgba(var(--v-theme-surface), 0.65);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(128,128,128, 0.2);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  padding: 12px;
  /* Snap logic */
  scroll-snap-align: start;
}

@media (max-width: 600px) {
  .kanban-container {
    padding-left: 0;
  }
  .kanban-col {
    /* Màn iPhone thường <400px, chừa viền 1 chút = 85vw để liếc thấy cột kia */
    flex: 0 0 85vw;
    width: 85vw;
  }
}

.kanban-col-header {
  font-size: 14px;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-left: 4px;
}

.kanban-col-body {
  flex-grow: 1;
  min-height: 50vh; /* DropZone area minimal height */
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin; /* Internal vertical scroll list */
}

.kanban-card {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease;
  user-select: none;
}

.ghost-card {
  opacity: 0.3;
  transform: scale(0.97) rotate(2deg);
  background: rgba(128,128,128, 0.1) !important;
}

.cursor-grab {
  cursor: grab;
}
.cursor-grab:active {
  cursor: grabbing;
}
</style>
