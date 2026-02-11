import { safeLocalStorage } from './safe-storage'

type Config = {
  theme: string
  volume: number
  quality: string
}

const STORAGE_KEYS = {
  CONFIG: '444radio-config',
  QUEUE: '444radio-queue',
  CHAT_MESSAGES: '444radio-chat-messages',
  CHAT_ARCHIVES: '444radio-chat-archives',
} as const

export function getStoredConfig(): Config | null {
  const data = safeLocalStorage.getItem(STORAGE_KEYS.CONFIG)
  if (!data) return null
  
  try {
    return JSON.parse(data)
  } catch {
    console.warn('Failed to parse stored config')
    return null
  }
}

export function setStoredConfig(config: Config): boolean {
  try {
    return safeLocalStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch {
    return false
  }
}

export function getStoredQueue<T>(): T[] {
  const data = safeLocalStorage.getItem(STORAGE_KEYS.QUEUE)
  if (!data) return []
  
  try {
    return JSON.parse(data)
  } catch {
    console.warn('Failed to parse stored queue')
    return []
  }
}

export function setStoredQueue<T>(queue: T[]): boolean {
  if (queue.length === 0) {
    safeLocalStorage.removeItem(STORAGE_KEYS.QUEUE)
    return true
  }
  
  try {
    return safeLocalStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue))
  } catch {
    return false
  }
}

export function getStoredChatMessages<T>(): T[] {
  const data = safeLocalStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES)
  if (!data) return []
  
  try {
    return JSON.parse(data)
  } catch {
    console.warn('Failed to parse stored chat messages')
    return []
  }
}

export function setStoredChatMessages<T>(messages: T[]): boolean {
  try {
    return safeLocalStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages))
  } catch {
    return false
  }
}

export { STORAGE_KEYS }
