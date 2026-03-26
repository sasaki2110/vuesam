<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CodeMasterItem } from '@/constants/mockData'

const props = defineProps<{
  label: string
  placeholder?: string
  options: readonly CodeMasterItem[]
}>()

const model = defineModel<CodeMasterItem | null>({ default: null })
const emit = defineEmits<{ enterNext: [] }>()

const inputValue = ref('')
const open = ref(false)
const highlighted = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

function findPartyByInput(raw: string): CodeMasterItem | null {
  const q = raw.trim()
  if (!q) return null
  const byCode = props.options.find((p) => p.code === q)
  if (byCode) return byCode
  const token = q.split(/\s+/)[0] ?? q
  const byCodeToken = props.options.find((p) => p.code === token)
  if (byCodeToken) return byCodeToken
  const lower = q.toLowerCase()
  const hits = props.options.filter(
    (p) => p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower),
  )
  return hits.length === 1 ? hits[0]! : null
}

function resolvePartyCommitFromInput(raw: string): CodeMasterItem | null {
  const fromFind = findPartyByInput(raw)
  if (fromFind) return fromFind
  const q = raw.trim().toLowerCase()
  if (!q) return null
  const filtered = props.options.filter(
    (o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
  )
  return filtered.length === 1 ? filtered[0]! : null
}

const filtered = computed(() => {
  const q = inputValue.value.trim().toLowerCase()
  if (!q) return [...props.options]
  return props.options.filter(
    (o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
  )
})

watch(
  model,
  (v) => {
    if (v) inputValue.value = `${v.code} ${v.name}`
    else inputValue.value = ''
  },
  { immediate: true },
)

function selectItem(o: CodeMasterItem) {
  model.value = o
  inputValue.value = `${o.code} ${o.name}`
  open.value = false
  emit('enterNext')
}

function onInput() {
  open.value = true
  highlighted.value = 0
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    const t = inputValue.value.trim()
    if (!t) {
      model.value = null
      return
    }
    const hit = resolvePartyCommitFromInput(t)
    if (hit) {
      model.value = hit
      inputValue.value = `${hit.code} ${hit.name}`
    }
  }, 120)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    open.value = true
    const n = filtered.value.length
    if (n === 0) return
    highlighted.value = Math.min(highlighted.value + 1, n - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlighted.value = Math.max(highlighted.value - 1, 0)
    return
  }
  if (e.key === 'Escape') {
    open.value = false
    return
  }
  if (e.key !== 'Enter' || e.shiftKey) return

  if (open.value && filtered.value.length > 0) {
    e.preventDefault()
    selectItem(filtered.value[highlighted.value]!)
    return
  }
  const hit = resolvePartyCommitFromInput(inputValue.value)
  if (hit) {
    e.preventDefault()
    model.value = hit
    inputValue.value = `${hit.code} ${hit.name}`
    open.value = false
    emit('enterNext')
    return
  }
  e.preventDefault()
  open.value = false
  emit('enterNext')
}

defineExpose({
  focus: () => {
    inputRef.value?.focus()
  },
})
</script>

<template>
  <div class="mc-wrap">
    <label class="mc-label">{{ label }}</label>
    <div class="mc-field">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="mc-input"
        :placeholder="placeholder"
        role="combobox"
        autocomplete="off"
        :aria-expanded="open && filtered.length > 0 ? 'true' : 'false'"
        aria-haspopup="listbox"
        @input="onInput"
        @focus="open = true"
        @blur="onBlur"
        @keydown="onKeyDown"
      />
      <ul v-show="open && filtered.length > 0" class="mc-list" role="listbox">
        <li
          v-for="(o, i) in filtered"
          :key="o.code"
          role="option"
          :class="{ active: i === highlighted }"
          @mousedown.prevent="selectItem(o)"
        >
          {{ o.code }} {{ o.name }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mc-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.mc-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}
.mc-field {
  position: relative;
}
.mc-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.23);
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
}
.mc-input:focus {
  outline: 2px solid #1976d2;
  outline-offset: 0;
  border-color: #1976d2;
}
.mc-list {
  position: absolute;
  z-index: 1400;
  left: 0;
  right: 0;
  top: 100%;
  margin: 2px 0 0;
  padding: 4px 0;
  max-height: 280px;
  overflow: auto;
  list-style: none;
  background: #fff;
  border: 1px solid #9aa7b8;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.mc-list li {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-list li:hover,
.mc-list li.active {
  background: rgba(25, 118, 210, 0.12);
}
</style>
