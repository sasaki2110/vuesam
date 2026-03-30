import { onMounted, onUnmounted } from 'vue'

export type ScreenFunctionKeyHandlers = {
  onNew: () => void
  onSave: () => void
}

/**
 * ウィンドウレベルで F01（ブラウザでは F1）/ F12 を拾い、業務ハンドラへ渡す。
 */
export function useScreenFunctionKeys(handlers: ScreenFunctionKeyHandlers) {
  function onKeyWindow(e: KeyboardEvent) {
    if (e.key === 'F1') {
      e.preventDefault()
      handlers.onNew()
      return
    }
    if (e.key === 'F12') {
      e.preventDefault()
      handlers.onSave()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyWindow, true)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyWindow, true)
  })
}
