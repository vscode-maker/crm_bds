<template>
  <v-app class="liquid-bg">
    <!-- ❄️ Auth page snowfall -->
    <div class="snowfall-container">
      <span
        v-for="i in 20"
        :key="i"
        class="snowflake"
        :style="{
          left: `${Math.random() * 100}%`,
          fontSize: `${0.5 + Math.random() * 1}em`,
          animationDuration: `${6 + Math.random() * 14}s`,
          animationDelay: `${Math.random() * 8}s`,
          opacity: 0.2 + Math.random() * 0.5,
        }"
      >❄</span>
    </div>
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh;">
      <v-container style="max-width: 450px;">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
