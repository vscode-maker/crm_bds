<template>
  <v-card class="pa-8" style="backdrop-filter: blur(20px);" elevation="0">
    <div class="text-center mb-8">
      <AnimatedLogo :size="64" :pulse="true" class="mx-auto mb-4" />
      <h1 class="text-h5 font-weight-bold mt-2">Zalo<span style="color: #0068FF;">EMS</span></h1>
      <p class="text-caption mt-1" style="color: #8892b0;">Multi-Account Zalo Management</p>
    </div>

    <v-form @submit.prevent="handleLogin">
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        variant="outlined"
        bg-color="transparent"
        prepend-inner-icon="mdi-email-outline"
        required
        class="mb-3 custom-input"
      />
      <v-text-field
        v-model="password"
        label="Mật khẩu"
        type="password"
        variant="outlined"
        bg-color="transparent"
        prepend-inner-icon="mdi-lock-outline"
        required
        class="mb-5 custom-input"
      />
      <v-btn type="submit" color="primary" block size="large" :loading="loading" rounded="xl">
        <v-icon start>mdi-login</v-icon>
        Đăng nhập
      </v-btn>
    </v-form>

    <v-alert v-if="error" type="error" class="mt-4" density="compact" closable variant="tonal">
      {{ error }}
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AnimatedLogo from '@/components/AnimatedLogo.vue';

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  try {
    const needs = await authStore.checkSetup();
    if (needs) router.replace('/setup');
  } catch {}
});

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(email.value, password.value);
    router.push('/');
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Đăng nhập thất bại';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* Trị tận gốc tính năng Autofill đổ bóng xám/vàng của Trình duyệt Chrome/Edge */
:deep(.custom-input input:-webkit-autofill),
:deep(.custom-input input:-webkit-autofill:hover),
:deep(.custom-input input:-webkit-autofill:focus),
:deep(.custom-input input:-webkit-autofill:active) {
  -webkit-text-fill-color: black !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* Xoá bóng nền overlay của Vuetify 3 nếu có */
:deep(.v-field__overlay) {
  background-color: transparent !important;
  opacity: 0 !important;
}
</style>
