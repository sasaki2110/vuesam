<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="home">
    <h1 class="title">生産管理デモ</h1>
    <RouterLink to="/orders/new" class="cta">受注登録画面へ</RouterLink>
  </div>
</template>

<style scoped>
.home {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem;
  box-sizing: border-box;
  background: linear-gradient(165deg, #eef2f7 0%, #f7f9fc 45%, #e8ecf2 100%);
}

.title {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 0.02em;
}

.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
  text-decoration: none;
  background: #1e3a5f;
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(30, 58, 95, 0.25);
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.cta:hover {
  background: #2d4a73;
  box-shadow: 0 4px 14px rgba(30, 58, 95, 0.35);
  transform: translateY(-1px);
}

.cta:focus-visible {
  outline: 2px solid #5ab0ff;
  outline-offset: 3px;
}

.cta:active {
  transform: translateY(0);
}
</style>
