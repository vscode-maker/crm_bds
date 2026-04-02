<template>
  <v-app :class="{ 'liquid-bg': isDark }">
    <!-- Top bar -->
    <v-app-bar density="comfortable" flat>
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <div class="d-flex align-center" style="gap: 12px;">
        <AnimatedLogo :size="32" :pulse="false" />
        <v-app-bar-title>
          <span class="font-weight-bold">Zalo</span><span style="color: #0068FF;">EMS</span>
        </v-app-bar-title>
      </div>

      <v-spacer />

      <!-- Header Actions -->
      <div class="d-flex align-center" style="gap: 4px;">
        <!-- Status indicator -->
        <div
          class="d-none d-sm-flex align-center px-3 py-1 rounded-pill"
          style="background: rgba(34, 139, 34, 0.1); border: 1px solid rgba(34, 139, 34, 0.2);"
        >
          <span
            class="status-dot"
            style="width: 8px; height: 8px; border-radius: 50%; background: #228B22; display: inline-block; margin-right: 8px;"
          ></span>
          <span class="text-caption font-weight-bold" style="color: #228B22; letter-spacing: 1px;">ONLINE</span>
        </div>

        <v-divider vertical inset class="mx-3 d-none d-sm-block"></v-divider>

        <!-- Notification -->
        <NotificationBell />

        <!-- Theme Toggle -->
        <v-btn icon variant="text" size="small" @click="toggleTheme" class="hidden-xs">
          <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
        </v-btn>

        <v-divider vertical inset class="mx-3"></v-divider>

        <!-- User Profile Menu -->
        <v-menu anchor="bottom end" offset-y :close-on-content-click="true">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" class="px-2 rounded-pill d-flex align-center" style="text-transform: none; height: 48px;">
              <v-avatar size="32" color="primary" class="mr-sm-2" style="background: linear-gradient(135deg, #0088FF, #0068FF);">
                <span class="text-caption text-white font-weight-bold">{{ authStore.user?.fullName?.charAt(0) || 'U' }}</span>
              </v-avatar>
              <div class="d-none d-sm-flex flex-column align-start mr-1">
                <span class="text-body-2 font-weight-bold" style="line-height: 1.2;">{{ authStore.user?.fullName }}</span>
                <span class="text-caption text-grey" style="line-height: 1; font-size: 10px;">Admin</span>
              </div>
              <v-icon class="d-none d-sm-flex ml-1 text-grey" size="18">mdi-chevron-down</v-icon>
            </v-btn>
          </template>
          
          <v-card min-width="220" rounded="xl" elevation="8" border>
            <v-list density="compact" class="py-2">
              <v-list-item>
                <template #title>
                  <div class="font-weight-bold">{{ authStore.user?.fullName }}</div>
                </template>
                <template #subtitle>
                  <div class="text-caption">{{ authStore.user?.email || 'admin@zaloems.local' }}</div>
                </template>
              </v-list-item>
              <v-divider class="my-2" />
              <v-list-item prepend-icon="mdi-account-circle-outline" title="Hồ sơ cá nhân" value="profile" />
              <v-list-item prepend-icon="mdi-cog-outline" title="Cài đặt hệ thống" to="/settings" />
              <v-list-item prepend-icon="mdi-theme-light-dark" title="Đổi giao diện" @click="toggleTheme" class="d-sm-none" />
              <v-divider class="my-2" />
              <v-list-item prepend-icon="mdi-logout" title="Đăng xuất" @click="logout" color="error" class="text-error" />
            </v-list>
          </v-card>
        </v-menu>
      </div>
    </v-app-bar>

    <!-- Sidebar navigation — Frosted Glassmorphism edition -->
    <v-navigation-drawer v-model="drawer" :rail="rail" @click="rail = false" class="frosted-sidebar" elevation="0">
      <v-list density="compact" nav class="mt-2">
        <v-list-item
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :prepend-icon="item.icon"
          :title="item.title"
          :value="item.path"
          rounded="xl"
          class="mb-1 mx-2"
        />
      </v-list>

      <template #append>
        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-chevron-left"
            title="Thu gọn"
            @click.stop="rail = !rail"
            rounded="xl"
            class="mx-2"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main>
      <v-container fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import NotificationBell from '@/components/NotificationBell.vue';
import AnimatedLogo from '@/components/AnimatedLogo.vue';

const theme = useTheme();
const authStore = useAuthStore();
const router = useRouter();

const drawer = ref(true);
const rail = ref(false);
const isDark = ref(localStorage.getItem('theme') !== 'light');

onMounted(() => {
  theme.global.name.value = isDark.value ? 'dark' : 'light';
});

const menuItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard-outline', path: '/' },
  { title: 'Tin nhắn', icon: 'mdi-message-text-outline', path: '/chat' },
  { title: 'Khách hàng', icon: 'mdi-account-group-outline', path: '/contacts' },
  { title: 'Tài khoản Zalo', icon: 'mdi-cellphone-link', path: '/zalo-accounts' },
  { title: 'Lịch hẹn', icon: 'mdi-calendar-clock-outline', path: '/appointments' },
  { title: 'Báo cáo', icon: 'mdi-chart-arc', path: '/reports' },
  { title: 'Nhân viên', icon: 'mdi-account-cog-outline', path: '/settings' },
  { title: 'API & Webhook', icon: 'mdi-api', path: '/api-settings' },
];

function toggleTheme() {
  isDark.value = !isDark.value;
  theme.global.name.value = isDark.value ? 'dark' : 'light';
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style>
.frosted-sidebar.v-navigation-drawer {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-right: none !important;
  border-left: none !important;
  border-inline-end: none !important;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.03) !important;
}

.liquid-bg .frosted-sidebar.v-navigation-drawer {
  background: rgba(30, 5, 5, 0.35) !important;
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.2) !important;
}
</style>
