import type { FunctionKey, KeyActionId, KeySpec } from '@/features/screen-engine/screenSpecTypes'

const DEFAULT_KEY_SPEC: Partial<Record<FunctionKey, KeyActionId>> = {
  F1: 'new',
  F12: 'save',
}

/** 共通既定（F1/F12）に Spec の上書きをマージする */
export function mergeKeySpec(overrides: KeySpec | undefined): KeySpec {
  return { ...DEFAULT_KEY_SPEC, ...(overrides ?? {}) }
}
