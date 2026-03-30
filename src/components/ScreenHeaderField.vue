<script setup lang="ts">
import { ref } from 'vue'
import MasterCombobox from '@/components/MasterCombobox.vue'
import type { CodeMasterItem } from '@/types/master'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'

const props = defineProps<{
  field: HeaderFieldSpec
  parties: readonly CodeMasterItem[]
}>()

const model = defineModel<unknown>({ required: true })

const emit = defineEmits<{
  enterNext: []
  dateFocus: []
}>()

const comboboxRef = ref<InstanceType<typeof MasterCombobox> | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)
const dateInputRef = ref<HTMLInputElement | null>(null)

defineExpose({
  focus: () => {
    if (props.field.editorType === 'masterCombobox') comboboxRef.value?.focus()
    else if (props.field.editorType === 'date') dateInputRef.value?.focus()
    else textInputRef.value?.focus()
  },
})

function onDateFocus() {
  emit('dateFocus')
}
</script>

<template>
  <MasterCombobox
    v-if="field.editorType === 'masterCombobox'"
    :id="field.id"
    ref="comboboxRef"
    v-model="(model as CodeMasterItem | null)"
    :label="field.label"
    :placeholder="field.placeholder"
    :options="parties"
    @enter-next="emit('enterNext')"
  />
  <div
    v-else
    class="field"
    :class="{ 'field-span2': field.gridColumnSpan === 2 }"
    :style="field.gridColumnSpan && field.gridColumnSpan !== 2 ? { gridColumn: `span ${field.gridColumnSpan}` } : undefined"
  >
    <label class="field-label" :for="field.id">{{ field.label }}</label>
    <input
      v-if="field.editorType === 'text'"
      :id="field.id"
      ref="textInputRef"
      v-model="(model as string)"
      type="text"
      class="field-input"
      :placeholder="field.placeholder"
      @keydown.enter.exact.prevent="emit('enterNext')"
    />
    <input
      v-else
      :id="field.id"
      ref="dateInputRef"
      v-model="(model as string)"
      type="date"
      class="field-input"
      @focus="onDateFocus"
      @keydown.enter.exact.prevent="emit('enterNext')"
    />
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.field-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}
.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.23);
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
}
.field-input:focus {
  outline: 2px solid #1976d2;
  outline-offset: 0;
  border-color: #1976d2;
}
@media (min-width: 768px) {
  .field-span2 {
    grid-column: span 2;
  }
}
</style>
