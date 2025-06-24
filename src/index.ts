import { defaultLogger } from './constants'
import { WithRedLockParams } from './types'

export type { WithRedLockParams } from './types'

export async function withRedLock<T>({
  resource,
  task,
  redisClient,
  logger = defaultLogger,
  lockTtlMs = 15_000,
  resultTtlMs = 10_000,
  pollIntervalMs = 100,
  pollTimeoutMs = 15_000,
}: WithRedLockParams<T>): Promise<T> {
  const log = logger
  const lockKey = `redLock:${resource}:lock`
  const resultKey = `redLock:${resource}:result`

  const gotLock = await redisClient.set(lockKey, '1', {
    NX: true,
    PX: lockTtlMs,
  })

  if (gotLock) {
    log.debug?.({ lockKey }, `Lock acquired (${lockKey}), running task`)
    try {
      const result = await task()
      await redisClient.set(resultKey, JSON.stringify(result), {
        PX: resultTtlMs,
      })
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
