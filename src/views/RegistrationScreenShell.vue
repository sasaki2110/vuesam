<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3'
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditingStoppedEvent,
  type CellValueChangedEvent,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community'
import { computed, onMounted, shallowRef } from 'vue'
import type { FieldError } from '@/features/screen-engine/validation/validationTypes'
import ScreenHeaderField from '@/components/ScreenHeaderField.vue'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'
import { useHeaderEnterNav } from '@/features/screen-engine/useHeaderEnterNav'
import type { RegistrationShellEmits, RegistrationShellProps } from '@/views/registrationScreenShell.types'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-balham.css'

ModuleRegistry.registerModules([AllCommunityModule])

const props = withDefaults(defineProps<RegistrationShellProps>(), {
  validationErrors: () => [] as FieldError[],
  gridSessionKey: 0,
})
const rowData = defineModel<unknown[]>('rowData', { required: true })
const emit = defineEmits<RegistrationShellEmits>()

const popupParentEl = shallowRef<HTMLElement | null>(null)
const gridApi = shallowRef<GridApi | null>(null)
const headerRefs = shallowRef(new Map<string, { focus: () => void }>())

function bindHeaderRef(id: string, el: unknown) {
  const m = new Map(headerRefs.value)
  if (
    el &&
    typeof el === 'object' &&
    el !== null &&
    'focus' in el &&
    typeof (el as { focus: unknown }).focus === 'function'
  ) {
    m.set(id, el as { focus: () => void })
  } else {
    m.delete(id)
  }
  headerRefs.value = m
}

const headerFieldRefCallbacks = new Map<string, (el: unknown) => void>()
function headerFieldRef(fieldId: string) {
  let cb = headerFieldRefCallbacks.get(fieldId)
  if (!cb) {
    cb = (el: unknown) => bindHeaderRef(fieldId, el)
    headerFieldRefCallbacks.set(fieldId, cb)
  }
  return cb
}

const navigationSpec = computed(() => props.navigationSpec)

const { focusNextAfter, focusFirstInHeaderChain } = useHeaderEnterNav({
  navigationSpec,
  getHeaderFocusMap: () => headerRefs.value,
  gridApi,
})

defineExpose({ focusFirstInHeaderChain })

const gridLinesErrorMessage = computed(() => {
  const msgs = props.validationErrors.filter((e) => e.fieldKey === 'lines').map((e) => e.message)
  return msgs.length ? msgs.join(' ') : ''
})

function headerFieldError(fieldId: string): string | undefined {
  return props.validationErrors.find((e) => e.fieldKey === fieldId)?.message
}

function onGridReady(e: GridReadyEvent) {
  gridApi.value = e.api
  emit('gridReady', e)
}

function onCellValueChanged(e: CellValueChangedEvent) {
  emit('cellValueChanged', e)
}

function onCellEditingStopped(e: CellEditingStoppedEvent) {
  emit('cellEditingStopped', e)
}

function onDateFieldFocus(field: HeaderFieldSpec) {
  emit('dateFocus', field)
}

onMounted(() => {
  popupParentEl.value = document.body
  requestAnimationFrame(() => focusFirstInHeaderChain())
})
</script>

<template>
  <div class="page">
    <header class="hdr">
      <h1 class="hdr-title">{{ title }}</h1>
      <div class="hdr-actions">
        <button type="button" class="btn btn-outline" @click="emit('new')">新規（F01）</button>
        <button type="button" class="btn btn-primary" @click="emit('save')">保存 (F12)</button>
      </div>
    </header>

    <div class="body">
      <main class="main">
        <section class="card header-card">
          <p class="hint">ヘッダ（Enter で次項目 ― 順序は Spec の navigationSpec）</p>
          <div class="header-grid">
            <ScreenHeaderField
              v-for="field in headerFields"
              :key="field.id"
              :ref="headerFieldRef(field.id)"
              v-model="header[field.id]!"
              :field="field"
              :parties="parties"
              :error="headerFieldError(field.id)"
              @enter-next="focusNextAfter(field.id)"
              @date-focus="onDateFieldFocus(field)"
            />
          </div>
        </section>

        <section class="card grid-card">
          <p class="hint grid-hint">
            {{ gridHint }}
          </p>
          <p v-if="gridLinesErrorMessage" class="grid-validation-msg" role="alert">
            {{ gridLinesErrorMessage }}
          </p>
          <div class="ag-theme-balham grid-wrap">
            <AgGridVue
              :key="gridSessionKey"
              v-model="rowData"
              theme="legacy"
              style="width: 100%; height: 100%"
              :enable-browser-tooltips="true"
              :popup-parent="popupParentEl"
              :column-defs="columnDefs"
              :default-col-def="defaultColDef"
              :get-row-id="getRowId"
              :single-click-edit="true"
              :enter-navigates-vertically="false"
              :enter-navigates-vertically-after-edit="false"
              @grid-ready="onGridReady"
              @cell-value-changed="onCellValueChanged"
              @cell-editing-stopped="onCellEditingStopped"
            />
          </div>
        </section>
      </main>

      <aside class="aside">
        <h2 class="aside-title">AI エージェント助言</h2>
        <div class="aside-body">
          <p
            v-for="text in [
              '納期がタイトです。前工程のロットと突合してください。',
              '入力中の単価は過去 6 か月平均より約 8% 低いです。',
              '△△電池工業向けはリコール履歴があるロットを避ける運用が推奨です。',
              'B002（鉛蓄電池パック）は在庫閾値を下回る見込みです。',
            ]"
            :key="text"
            class="advice"
          >
            {{ text }}
          </p>
          <p class="aside-note">※ダミー表示です。実装時はルール／学習モデルと連携してください。</p>

          <h3 class="aside-sub">マスタ一覧（API）</h3>
          <p class="aside-cap">取引先（契約先・納入先）</p>
          <ul class="master-list">
            <li v-for="p in parties" :key="p.code">{{ p.code }}：{{ p.name }}</li>
          </ul>
          <p class="aside-cap">製品（明細）</p>
          <ul class="master-list">
            <li v-for="p in products" :key="p.code">{{ p.code }}：{{ p.name }}</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: #dfe6ec;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.hdr {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #94a3b8;
  background: #cfd8e3;
}
.hdr-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  font-family: ui-monospace, monospace;
}
.hdr-actions {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 6px 12px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  border-radius: 4px;
}
.btn-outline {
  border: 1px solid rgba(0, 0, 0, 0.35);
  background: #fff;
  color: inherit;
}
.btn-primary {
  border: none;
  background: #1976d2;
  color: #fff;
}
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
}
.card {
  border: 1px solid #9aa7b8;
  border-radius: 0;
  background: #eef2f6;
}
.header-card {
  padding: 12px;
}
.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}
.header-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 768px) {
  .header-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.grid-card {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f7f9fc;
}
.grid-hint {
  flex-shrink: 0;
  padding: 4px 8px;
  margin: 0;
  border-bottom: 1px solid #9aa7b8;
}
.grid-validation-msg {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 8px;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  font-family: ui-monospace, monospace;
}
.grid-wrap {
  flex: 1;
  min-height: 0;
  padding: 4px;
}
.aside {
  width: min(100%, 380px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #94a3b8;
  background: #1e2a38;
  color: #f1f5f9;
  min-height: 0;
}
.aside-title {
  margin: 0;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  border-bottom: 1px solid #3d4f63;
  flex-shrink: 0;
}
.aside-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.advice {
  margin: 0;
  padding: 8px;
  font-size: 13px;
  line-height: 1.5;
  background: #2a3a4d;
  border-left: 3px solid #5ab0ff;
  border-radius: 4px;
  color: #f8fafc;
}
.aside-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}
.aside-sub {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid #3d4f63;
  font-size: 14px;
  font-family: ui-monospace, monospace;
}
.aside-cap {
  margin: 0 0 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.78);
}
.master-list {
  margin: 0;
  padding: 8px 8px 8px 20px;
  font-size: 12px;
  line-height: 1.65;
  font-family: ui-monospace, monospace;
  background: #243040;
  border: 1px solid #3d4f63;
  border-radius: 4px;
  color: #f8fafc;
}
</style>

<!-- AG Grid はセルがシャドウ側のため scoped では当たらない -->
<style>
.ag-theme-balham .ag-cell.ag-cell-validation-error {
  background-color: #fef2f2 !important;
  border-bottom: 2px solid #dc2626 !important;
}
</style>
