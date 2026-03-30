<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CodeMasterItem } from '@/constants/mockData'
import type { CodeAutocompleteCellEditorParams } from '@/features/screen-engine/types'

const props = defineProps<{ params: CodeAutocompleteCellEditorParams }>()

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

function matchProduct(raw: string): CodeMasterItem | null {
  const q = raw.trim()
  if (!q) return null
  const u = q.toUpperCase()
  const list = props.params.options
  return list.find((p) => p.code === q) ?? list.find((p) => p.code.toUpperCase() === u) ?? null
}

function initFromInitial(initial: string | null | undefined): {
  selected: CodeMasterItem | null
  input: string
} {
  const raw = String(initial ?? '').trim()
  if (!raw) return { selected: null, input: '' }
  const hit = matchProduct(raw)
  if (hit) return { selected: hit, input: `${hit.code} ${hit.name}` }
  return { selected: null, input: raw }
}

const start = initFromInitial(props.params.value ?? undefined)
const selected = ref<CodeMasterItem | null>(start.selected)
const inputValue = ref(start.input)
const open = ref(true)
/** -1 = 入力中（リスト行未フォーカス）、0..n-1 = キーボードで選択中の行 */
const highlighted = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLUListElement | null>(null)

/** Teleport 先パネル（scoped が効かないため class + グローバル CSS で装飾） */
const dropdownPanelStyle = ref<Record<string, string>>({
  position: 'fixed',
  visibility: 'hidden',
  top: '0',
  left: '0',
  width: '400px',
  maxHeight: '280px',
  zIndex: '2147483000',
  boxSizing: 'border-box',
})

const filtered = computed(() => {
  const list = props.params.options
  const q = inputValue.value.trim().toLowerCase()
  if (!q) return [...list]
  return list.filter(
    (o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
  )
})

let positionRaf = 0

function syncDropdownPanelPosition() {
  const inp = inputRef.value
  if (!inp || !open.value || filtered.value.length === 0) return
  const r = inp.getBoundingClientRect()
  if (r.width < 1 && r.height < 1) return
  const w = Math.min(Math.max(400, r.width), window.innerWidth - r.left - 8)
  const maxH = Math.min(280, Math.max(80, window.innerHeight - r.bottom - 12))
  dropdownPanelStyle.value = {
    position: 'fixed',
    top: `${Math.round(r.bottom + 2)}px`,
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(w)}px`,
    maxHeight: `${Math.round(maxH)}px`,
    zIndex: '2147483000',
    boxSizing: 'border-box',
    visibility: 'visible',
  }
}

function startDropdownPositionLoop() {
  cancelAnimationFrame(positionRaf)
  const loop = () => {
    syncDropdownPanelPosition()
    if (open.value && filtered.value.length > 0) {
      positionRaf = requestAnimationFrame(loop)
    }
  }
  positionRaf = requestAnimationFrame(loop)
}

function schedulePanelSync() {
  cancelAnimationFrame(positionRaf)
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncDropdownPanelPosition()
        startDropdownPositionLoop()
      })
    })
  })
}

watch(
  () => [open.value, filtered.value.length] as const,
  ([isOpen, n]) => {
    cancelAnimationFrame(positionRaf)
    if (isOpen && n > 0) {
      schedulePanelSync()
    } else {
      dropdownPanelStyle.value = {
        ...dropdownPanelStyle.value,
        visibility: 'hidden',
      }
    }
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  cancelAnimationFrame(positionRaf)
})

function push(raw: string) {
  selected.value = matchProduct(raw)
}

function commitStop() {
  nextTick(() => props.params.stopEditing(false))
}

function pickFromList(o: CodeMasterItem) {
  selected.value = o
  inputValue.value = `${o.code} ${o.name}`
  push(o.code)
  open.value = false
  commitStop()
}

function onInput() {
  open.value = true
  highlighted.value = -1
  push(inputValue.value)
}

function onOptionPointerEnter(i: number) {
  highlighted.value = i
}

function scrollActiveIntoView() {
  const list = listRef.value
  if (!list || highlighted.value < 0) return
  const code = filtered.value[highlighted.value]?.code
  if (!code) return
  list.querySelector(`#pce-opt-${CSS.escape(code)}`)?.scrollIntoView({ block: 'nearest' })
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    props.params.onKeyDown(e)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    open.value = true
    const n = filtered.value.length
    if (n === 0) return
    if (highlighted.value < 0) {
      highlighted.value = 0
    } else {
      highlighted.value = Math.min(highlighted.value + 1, n - 1)
    }
    nextTick(scrollActiveIntoView)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const n = filtered.value.length
    if (n === 0) return
    if (highlighted.value < 0) {
      return
    }
    if (highlighted.value <= 0) {
      highlighted.value = -1
      return
    }
    highlighted.value = highlighted.value - 1
    nextTick(scrollActiveIntoView)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    if (open.value && filtered.value.length > 0) {
      e.preventDefault()
      if (highlighted.value >= 0) {
        pickFromList(filtered.value[highlighted.value]!)
        return
      }
      props.params.stopEditing(false)
      return
    }
    e.preventDefault()
    props.params.stopEditing(false)
  }
}

function getValue(): string {
  if (selected.value) return normalizeCode(selected.value.code)
  return normalizeCode(inputValue.value)
}

function isPopup() {
  return true
}

function getPopupPosition() {
  return 'over' as const
}

function afterGuiAttached() {
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
    schedulePanelSync()
  })
}

defineExpose({
  getValue,
  isPopup,
  getPopupPosition,
  afterGuiAttached,
})

onMounted(() => {
  queueMicrotask(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
    schedulePanelSync()
  })
})
</script>

<template>
  <div class="pce-root ag-custom-component-popup">
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      class="pce-input"
      role="combobox"
      autocomplete="off"
      :aria-expanded="open && filtered.length > 0 ? 'true' : 'false'"
      aria-haspopup="listbox"
      :aria-activedescendant="
        highlighted >= 0 && filtered[highlighted] ? `pce-opt-${filtered[highlighted]!.code}` : undefined
      "
      @input="onInput"
      @focus="open = true"
      @keydown="onKeyDown"
    />
    <Teleport to="body">
      <ul
        v-show="open && filtered.length > 0"
        ref="listRef"
        class="pce-product-code-dropdown"
        role="listbox"
        :style="dropdownPanelStyle"
      >
        <li
          v-for="(o, i) in filtered"
          :key="o.code"
          :id="`pce-opt-${o.code}`"
          role="option"
          class="pce-product-code-dropdown__item"
          :class="{ 'pce-product-code-dropdown__item--active': i === highlighted }"
          :data-active="i === highlighted ? '1' : '0'"
          :aria-selected="i === highlighted ? 'true' : 'false'"
          @mouseenter="onOptionPointerEnter(i)"
          @mousedown.prevent="pickFromList(o)"
        >
          {{ o.code }} {{ o.name }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.pce-root {
  min-width: 400px;
  width: max(100%, 400px);
  max-width: min(520px, calc(100vw - 24px));
  padding: 2px 0;
  box-sizing: border-box;
  position: relative;
  overflow: visible;
}
.pce-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 4px;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.42);
  font-size: 14px;
  background: transparent;
}
.pce-input:focus {
  outline: none;
  border-bottom-width: 2px;
  border-bottom-color: #1976d2;
}
.pce-root.pce-root {
  user-select: text;
  -webkit-user-select: text;
}
</style>

<!--
  Teleport で body 直下へ出したノードには scoped の data-v が付かないため、
  ここは非 scoped で確実に当てる（ホバー／キーボード選択の見た目が効かない問題の修正）
-->
<style>
ul.pce-product-code-dropdown {
  margin: 0;
  padding: 6px 0;
  list-style: none !important;
  overflow-y: auto;
  background: #ffffff !important;
  border: 2px solid #283593 !important;
  border-radius: 8px !important;
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.25),
    0 4px 16px rgba(0, 0, 0, 0.15) !important;
  pointer-events: auto !important;
}

ul.pce-product-code-dropdown > li.pce-product-code-dropdown__item {
  margin: 0 !important;
  padding: 10px 14px 10px 16px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  line-height: 1.35 !important;
  font-family: system-ui, sans-serif !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  color: #111827 !important;
  background: #ffffff !important;
  border-left: 5px solid transparent !important;
}

ul.pce-product-code-dropdown > li.pce-product-code-dropdown__item:hover {
  background: #e8eaf6 !important;
}

ul.pce-product-code-dropdown > li.pce-product-code-dropdown__item--active,
ul.pce-product-code-dropdown > li.pce-product-code-dropdown__item[data-active='1'] {
  background: #283593 !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  border-left-color: #1a237e !important;
}
</style>
