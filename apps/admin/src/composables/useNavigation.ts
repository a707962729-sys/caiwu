/**
 * 导航防抖 Hook - 防止快速点击导致路由卡死
 * 
 * 修复：增加超时保护，确保锁一定会被释放
 */
import { ref } from 'vue'
import router from '@/router'

// 全局导航锁
const isNavigating = ref(false)

// 超时保护：5秒后强制释放锁
let navigationTimeout: ReturnType<typeof setTimeout> | null = null

function clearNavigationLock() {
  if (navigationTimeout) {
    clearTimeout(navigationTimeout)
    navigationTimeout = null
  }
  isNavigating.value = false
}

function acquireNavigationLock() {
  // 清除之前的超时
  clearNavigationLock()
  // 设置新的超时
  navigationTimeout = setTimeout(() => {
    console.warn('[Navigation] Lock timeout - forcing release')
    clearNavigationLock()
  }, 5000)
  isNavigating.value = true
}

// 只注册一次 afterEach
let initialized = false
function initAfterEach() {
  if (initialized) return
  initialized = true

  router.afterEach(() => {
    // 路由完成，释放锁
    clearNavigationLock()
  })

  // 也处理导航取消/失败的情况
  router.onError(() => {
    console.warn('[Navigation] Navigation error - releasing lock')
    clearNavigationLock()
  })
}

/**
 * 安全导航 - 带防抖和锁保护
 */
export function useSafeNavigate() {
  const safeNavigate = async (path: string, replace = false) => {
    // 已经在目标路径，无需导航
    if (router.currentRoute.value.path === path) {
      return
    }

    // 正在导航中，等待完成
    if (isNavigating.value) {
      console.warn('[Navigation] Blocked - navigation in progress:', path)
      // 强制等待一小段时间后重试
      await new Promise(resolve => setTimeout(resolve, 100))
      // 再次检查
      if (router.currentRoute.value.path === path) {
        return
      }
      if (isNavigating.value) {
        // 仍然在导航中，使用replace强制切换
        console.warn('[Navigation] Force replacing:', path)
      }
    }

    // 获取锁
    acquireNavigationLock()

    try {
      if (replace) {
        await router.replace(path)
      } else {
        await router.push(path)
      }
      // 成功后会通过 afterEach 释放锁
    } catch (error: any) {
      // 路由取消或重复导航不算错误
      if (error.name !== 'NavigationDuplicated' && 
          error.name !== 'NavigationCancelled' &&
          error.name !== 'Redirected') {
        console.error('[Navigation] Error:', error)
      }
      // 出错也要释放锁
      clearNavigationLock()
    }
  }

  const isNavigationLocked = () => isNavigating.value

  return {
    safeNavigate,
    isNavigationLocked
  }
}

// 立即初始化
initAfterEach()

export { isNavigating }
