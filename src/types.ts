import IORedis from 'ioredis'

export interface SimpleLogger {
  debug?: (meta: Record<string, unknown>, message: string) => void
  info?: (meta: Record<string, unknown>, message: string) => void
  warn?: (meta: Record<string, unknown>, message: string) => void
  error?: (meta: Record<string, unknown>, message: string) => void
}

export type WithRedLockParams<T> = {
  redisClient: IORedis
  resource: string
  task: () => Promise<T>
  logger?: SimpleLogger
  lockTtlMs?: number
  resultTtlMs?: number
  pollIntervalMs?: number
  pollTimeoutMs?: number
}
