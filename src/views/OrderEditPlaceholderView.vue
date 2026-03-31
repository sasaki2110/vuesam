<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <div class="wrap">
    <h1 class="title">受注編集</h1>
    <p class="msg">受注 ID <strong>{{ id }}</strong> の編集画面は未実装です。</p>
    <RouterLink to="/orders" class="back">受注一覧へ戻る</RouterLink>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 2rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: #f1f5f9;
  color: #0f172a;
}
.title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}
.msg {
  margin: 0 0 1.25rem;
  line-height: 1.6;
}
.back {
  color: #1d4ed8;
  font-weight: 600;
}
</style>
