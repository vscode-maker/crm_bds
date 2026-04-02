<template>
  <div class="zalo-animated-container" :style="containerStyle">
    <div class="zalo-bubble">
      <!-- Chữ Z hoặc Zalo EMS bên trong -->
      <span class="zalo-letter">Z</span>
      
      <!-- 3 dấu chấm Animated (chỉ hiện lên rồi mờ đi) -->
      <div class="zalo-typing">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
    <!-- Hiệu ứng toả sóng Pulse phía sau (tùy chọn bật tắt bằng prop) -->
    <div v-if="pulse" class="zalo-pulse-ring"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  size: {
    type: [Number, String],
    default: 64,
  },
  pulse: {
    type: Boolean,
    default: true,
  }
});

const containerStyle = computed(() => {
  const s = typeof props.size === 'number' ? `${props.size}px` : props.size;
  return {
    width: s,
    height: s,
    '--logo-size': s,
    '--font-size-z': `calc(${s} * 0.5)`,
    '--font-size-hat': `calc(${s} * 0.45)`,
  };
});
</script>

<style scoped>
.zalo-animated-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Kích thước phụ thuộc vào --logo-size prop */
}

/* KẾT CẤU BONG BÓNG ZALO CHAT (Zalo Blue) */
.zalo-bubble {
  position: relative;
  width: 90%;
  height: 90%;
  background: linear-gradient(135deg, #0088FF 0%, #0068FF 100%);
  /* Bo góc Zalo: Vuông tròn ở trên, góc dưới trái/phải uốn chéo */
  border-radius: 40% 40% 15% 40%;
  box-shadow: 0 8px 16px rgba(0, 104, 255, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
  
  /* Hiệu ứng nổi bồng bềnh */
  animation: float 4s ease-in-out infinite;
}

/* Đuôi (Tail) của bong bóng Zalo */
.zalo-bubble::after {
  content: '';
  position: absolute;
  bottom: -4%;
  right: 18%;
  width: 25%;
  height: 25%;
  background: #0068FF;
  /* Cấu trúc uốn cái đuôi chỉ xuống giống các icon Chat */
  border-bottom-right-radius: 80%;
  transform: rotate(20deg) skewX(-20deg);
  z-index: -1;
  box-shadow: 4px 4px 6px rgba(0, 104, 255, 0.2);
}

/* CHỮ Z GIỮA LOGO */
.zalo-letter {
  color: #fff;
  font-family: 'Share Tech Mono', 'Inter', sans-serif;
  font-size: var(--font-size-z, 32px);
  font-weight: 800;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  /* Animation hiện chữ từ chấm */
  animation: fadeZ 6s infinite;
}

/* TYPING DOTS (hiệu ứng 3 dấu chấm đang Gõ chữ của Zalo) */
.zalo-typing {
  position: absolute;
  display: flex;
  gap: 12%;
  animation: fadeDots 6s infinite;
}

.zalo-typing .dot {
  width: calc(var(--logo-size) * 0.1);
  height: calc(var(--logo-size) * 0.1);
  background: white;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.zalo-typing .dot:nth-child(2) { animation-delay: 0.2s; }
.zalo-typing .dot:nth-child(3) { animation-delay: 0.4s; }

/* VÒNG TRÒN TOẢ RA BÊN NGOÀI (Pulse Ring) */
.zalo-pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #0068FF;
  z-index: 1;
  animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

/* -------------- ANIMATIONS -------------- */

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8%); }
}

@keyframes wiggle {
  0%, 100% { transform: rotate(15deg); }
  50% { transform: rotate(25deg); }
}

@keyframes pulse-ring {
  0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-50%); }
}

/* Đổi chỗ giữa Dấu chấm và Chữ Z để tạo cảm giác AI đang chat! */
@keyframes fadeZ {
  0%, 20%, 80%, 100% { opacity: 1; visibility: visible; }
  25%, 75% { opacity: 0; visibility: hidden; }
}

@keyframes fadeDots {
  0%, 20%, 80%, 100% { opacity: 0; visibility: hidden; }
  25%, 75% { opacity: 1; visibility: visible; }
}
</style>
