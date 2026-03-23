import { ref, type Ref, onUnmounted } from 'vue'

interface UseRequestOptions<T> {
  immediate?: boolean // 是否立即执行
  initialData?: T // 初始数据
  onSuccess?: (data: T) => void // 成功回调
  onError?: (error: Error) => void // 错误回调
  onFinally?: () => void // 完成回调
}

interface UseRequestReturn<T> {
  data: Ref<T | undefined>
  loading: Ref<boolean>
  error: Ref<Error | null>
  execute: () => Promise<T | undefined>
  abort: () => void
  reset: () => void
}

/**
 * 通用请求 Hook
 * - 支持请求取消 (AbortController)
 * - 支持 loading/error/data 状态管理
 * - 支持成功/错误回调
 */
export function useRequest<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: UseRequestOptions<T> = {}
): UseRequestReturn<T> {
  const { immediate = true, initialData, onSuccess, onError, onFinally } = options

  const data = ref<T | undefined>(initialData) as Ref<T | undefined>
  const loading = ref(false)
  const error = ref<Error | null>(null)

  let controller: AbortController | null = null

  const execute = async (): Promise<T | undefined> => {
    // 取消之前的请求
    if (controller) {
      controller.abort()
    }

    controller = new AbortController()
    loading.value = true
    error.value = null

    try {
      const result = await fetcher(controller.signal)
      data.value = result
      onSuccess?.(result)
      return result
    } catch (err: any) {
      // 忽略取消请求的错误
      if (err.name === 'AbortError') {
        return
      }
      error.value = err
      onError?.(err)
      throw err
    } finally {
      loading.value = false
      onFinally?.()
    }
  }

  const abort = () => {
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  const reset = () => {
    abort()
    data.value = initialData
    loading.value = false
    error.value = null
  }

  // 组件卸载时取消请求
  onUnmounted(() => {
    abort()
  })

  // 立即执行
  if (immediate) {
    execute()
  }

  return {
    data,
    loading,
    error,
    execute,
    abort,
    reset
  }
}

/**
 * 分页请求 Hook
 * - 支持加载更多
 * - 支持下拉刷新
 */
interface UsePaginationOptions<T> {
  pageSize?: number
  immediate?: boolean
}

interface UsePaginationReturn<T> {
  list: Ref<T[]>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  hasMore: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  abort: () => void
}

export function usePagination<T>(
  fetcher: (params: { page: number; pageSize: number; signal?: AbortSignal }) => Promise<{
    list: T[]
    total: number
  }>,
  options: UsePaginationOptions<T> = {}
): UsePaginationReturn<T> {
  const { pageSize = 20, immediate = true } = options

  const list = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const refreshing = ref(false)
  const hasMore = ref(true)
  const error = ref<Error | null>(null)

  let page = 1
  let total = 0
  let controller: AbortController | null = null

  const abort = () => {
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  const refresh = async () => {
    abort()
    controller = new AbortController()
    
    refreshing.value = true
    loading.value = true
    error.value = null
    page = 1

    try {
      const result = await fetcher({ page, pageSize, signal: controller.signal })
      list.value = result.list
      total = result.total
      hasMore.value = list.value.length < total
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        error.value = err
      }
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  const loadMore = async () => {
    if (loading.value || !hasMore.value) return

    abort()
    controller = new AbortController()
    
    loading.value = true
    page++

    try {
      const result = await fetcher({ page, pageSize, signal: controller.signal })
      list.value = [...list.value, ...result.list]
      total = result.total
      hasMore.value = list.value.length < total
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        error.value = err
        page-- // 回退页码
      }
    } finally {
      loading.value = false
    }
  }

  onUnmounted(abort)

  if (immediate) {
    refresh()
  }

  return {
    list,
    loading,
    refreshing,
    hasMore,
    error,
    refresh,
    loadMore,
    abort
  }
}