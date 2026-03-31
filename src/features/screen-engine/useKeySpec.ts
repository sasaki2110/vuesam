import { onMounted, onUnmounted } from 'vue'
import { mergeKeySpec } from '@/features/screen-engine/defaultKeySpec'
import type { FunctionKey, KeyActionId, KeySpec } from '@/features/screen-engine/screenSpecTypes'

export type KeySpecHandlers = Partial<Record<KeyActionId, () => void>>

/**
 * 現在の Spec の keySpec を参照して F1〜F12 を振り分ける。
 * アクションに対応するハンドラが無い場合は preventDefault しない（未割り当て扱い）。
 *
 * onMounted 内で onUnmounted を呼ぶと、実行時点で active instance が無く
 * クリーンアップが登録されずリスナーがリークする（F キーが複数回発火する原因になる）。
 * 登録・解除はいずれも setup 同期で行う。
 */
export function useKeySpec(getKeySpec: () => KeySpec, handlers: KeySpecHandlers) {
  function onKeyWindow(e: KeyboardEvent) {
    if (!/^F([1-9]|1[0-2])$/.test(e.key)) return
    if (e.repeat) return
    const spec = mergeKeySpec(getKeySpec())
    const action = spec[e.key as FunctionKey]
    if (!action) return
    const fn = handlers[action]
    if (!fn) return
    e.preventDefault()
    fn()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyWindow, true)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyWindow, true)
  })
}
