<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchHealth, fetchProjects, getApiBaseUrl, login } from '@/api/client'

const apiBasePreview = getApiBaseUrl()
const router = useRouter()

const smokeBusy = ref(false)
const smokeLog = ref('')
const smokeError = ref('')

function logLine(msg: string) {
  smokeLog.value += (smokeLog.value ? '\n' : '') + msg
}

async function runHealth() {
  smokeError.value = ''
  smokeLog.value = ''
  smokeBusy.value = true
  try {
    const body = await fetchHealth()
    logLine(JSON.stringify(body, null, 2))
  } catch (e) {
    smokeError.value = e instanceof Error ? e.message : String(e)
  } finally {
    smokeBusy.value = false
  }
}

async function runLoginAndProjects(username: string, password: string) {
  smokeError.value = ''
  smokeLog.value = ''
  smokeBusy.value = true
  try {
    const { accessToken } = await login(username, password)
    sessionStorage.setItem('accessToken', accessToken)
    logLine('login OK, token stored in sessionStorage')
    const projects = await fetchProjects()
    logLine('projects:')
    logLine(JSON.stringify(projects, null, 2))
  } catch (e) {
    smokeError.value = e instanceof Error ? e.message : String(e)
  } finally {
    smokeBusy.value = false
  }
}

async function runLoginAndGoOrders(username: string, password: string) {
  smokeError.value = ''
  smokeLog.value = ''
  smokeBusy.value = true
  try {
    const { accessToken } = await login(username, password)
    sessionStorage.setItem('accessToken', accessToken)
    logLine('login OK, go to /orders/new')
    await router.push('/orders/new')
  } catch (e) {
    smokeError.value = e instanceof Error ? e.message : String(e)
  } finally {
    smokeBusy.value = false
  }
}
</script>

<template>
  <div class="home">
    <h1 class="title">生産管理デモ</h1>
    <RouterLink to="/orders/new" class="cta">受注登録画面へ</RouterLink>

    <details class="dev-smoke">
      <summary>API 疎通（開発用）</summary>
      <p class="dev-meta">
        <code>VITE_API_BASE_URL</code>:
        <strong>{{ apiBasePreview || '(空)' }}</strong>
      </p>
      <div class="dev-actions">
        <button type="button" class="dev-btn" :disabled="smokeBusy" @click="runHealth">
          GET /health
        </button>
        <button
          type="button"
          class="dev-btn"
          :disabled="smokeBusy"
          @click="runLoginAndProjects('demo', 'password')"
        >
          ログイン → プロジェクト一覧
        </button>
        <button
          type="button"
          class="dev-btn"
          :disabled="smokeBusy"
          @click="runLoginAndGoOrders('demo', 'password')"
        >
          ログイン → 受注登録画面へ
        </button>
      </div>
      <p v-if="smokeError" class="dev-err">{{ smokeError }}</p>
      <pre v-if="smokeLog" class="dev-out">{{ smokeLog }}</pre>
    </details>
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
  padding-bottom: 3rem;
  box-sizing: border-box;
  background: linear-gradient(165deg, #eef2f7 0%, #f7f9fc 45%, #e8ecf2 100%);
}

.dev-smoke {
  max-width: 42rem;
  width: 100%;
  margin-top: auto;
  padding: 0.75rem 1rem;
  font-size: 13px;
  color: #334155;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}

.dev-smoke summary {
  cursor: pointer;
  font-weight: 600;
}

.dev-meta {
  margin: 0.75rem 0 0.5rem;
  line-height: 1.5;
}

.dev-meta code {
  font-size: 12px;
}

.dev-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dev-btn {
  padding: 0.4rem 0.75rem;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #64748b;
  border-radius: 6px;
  background: #f1f5f9;
  color: #1e293b;
}

.dev-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.dev-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dev-err {
  margin: 0.75rem 0 0;
  color: #b91c1c;
  font-size: 13px;
}

.dev-out {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  max-height: 16rem;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
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
