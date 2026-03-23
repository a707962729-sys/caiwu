import { ref, type Ref } from 'vue'

/**
 * 下拉刷新 Hook
 */
export function useRefresh(callback: () => Promise<void>) {
  const refreshing = ref(false)
  const startY = ref(0)
  const currentY = ref(0)
  const isDragging = ref(false)
  const threshold = 80

  const onTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.value = e.touches[0].clientY
      isDragging.value = true
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging.value) return
    currentY.value = e.touches[0].clientY
  }

  const onTouchEnd = async () => {
    if (!isDragging.value) return
    isDragging.value = false
    
    if (currentY.value - startY.value > threshold && !refreshing.value) {
      refreshing.value = true
      try {
        await callback()
      } finally {
        refreshing.value = false
      }
    }
    
    startY.value = 0
    currentY.value = 0
  }

  return {
    refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd
  }
}

/**
 * 防抖 Hook
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 节流 Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let lastTime = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn(...args)
    }
  }
}

/**
 * 本地存储 Hook
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const stored = localStorage.getItem(key)
  const value = ref<T>(stored ? JSON.parse(stored) : defaultValue) as Ref<T>

  const setValue = (newValue: T) => {
    value.value = newValue as any
    localStorage.setItem(key, JSON.stringify(newValue))
  }

  const remove = () => {
    value.value = defaultValue as any
    localStorage.removeItem(key)
  }

  return { value, setValue, remove }
}