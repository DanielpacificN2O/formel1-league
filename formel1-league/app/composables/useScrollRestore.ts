import { ref, watch, nextTick, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

export function useScrollRestore(key: string, loading: Ref<boolean>) {
  const savedY = ref<number | null>(null)

  onBeforeRouteLeave(() => {
    sessionStorage.setItem(`scroll:${key}`, String(window.scrollY))
  })

  onMounted(() => {
    const saved = sessionStorage.getItem(`scroll:${key}`)
    if (saved != null) {
      sessionStorage.removeItem(`scroll:${key}`)
      savedY.value = parseInt(saved)
    }
  })

  watch(loading, (isLoading) => {
    if (!isLoading && savedY.value != null) {
      nextTick(() => {
        window.scrollTo({ top: savedY.value!, behavior: 'instant' })
        savedY.value = null
      })
    }
  })
}
