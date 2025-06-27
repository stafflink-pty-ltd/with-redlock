import { defaultLogger } from './constants'
import { WithRedLockParams } from './types'

export type { WithRedLockParams } from './types'

/**
 * A simple redlock implementation to prevent multiple processes from running the same task concurrently.
 * It uses Redis to acquire a lock and store the result of the task.
 *
 * @param redisClient - The Redis client instance to use for locking and result storage.
 * @param resource - The resource name to lock on.
 * @param task - The task to run.
 * @param logger - optional: The logger instance.
 * @param lockTtlMs - optional: The time-to-live for the lock in milliseconds (default 15s).
 * @param resultTtlMs - optional: The time-to-live for the result in milliseconds (default 10s).
 * @param pollIntervalMs - optional: The interval to poll for the result in milliseconds (default 100ms).
 * @param pollTimeoutMs - optional: The timeout for polling in milliseconds (default 15s).
 */
export async function withRedLock<T>({
  redisClient,
  resource,
  task,
  logger = defaultLogger,
  lockTtlMs = 15_000,
  resultTtlMs = 10_000,
  pollIntervalMs = 100,
  pollTimeoutMs = 15_000,
}: WithRedLockParams<T>): Promise<T> {
  const log = logger
  const lockKey = `redLock:${resource}:lock`
  const resultKey = `redLock:${resource}:result`

  const gotLock = await redisClient.set(lockKey, '1', 'PX', lockTtlMs, 'NX')

  if (gotLock) {
    log.debug?.({ lockKey }, `Lock acquired (${lockKey}), running task`)
    try {
      const result = await task()
      await redisClient.set(
        resultKey,
        JSON.stringify(result),
        'PX',
        resultTtlMs,
      )

      return result
    } finally {
      await redisClient.del(lockKey)
      log.debug?.({ lockKey }, `Lock released (${lockKey})`)
    }
  }

  log.debug?.({ lockKey }, `Lock busy (${lockKey}), waiting for result…`)
  let raw: string | null
  const pollStartTime = Date.now()

  do {
    const elapsedTime = Date.now() - pollStartTime
    if (elapsedTime > pollTimeoutMs) {
      log.warn?.(
        { lockKey, resultKey },
        `Polling timed out (${lockKey}: ${resultKey}), giving up`,
      )
      throw new Error(`Polling timed out (${lockKey}: ${resultKey}), giving up`)
    }

    raw = await redisClient.get(resultKey)
    if (raw) {
      try {
        return JSON.parse(raw) as T
      } catch (err) {
        const parseErrorMsg = `Failed to parse result from Redis (${lockKey}: ${resultKey})`
        log.error?.({ lockKey, resultKey, raw }, parseErrorMsg)
        throw new Error(parseErrorMsg)
      }
    }

    await new Promise(r => setTimeout(r, pollIntervalMs))
  } while (!raw)

  // unreachable
  throw new Error('Unexpected exit from polling loop')
}
