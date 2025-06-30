import { range } from 'ramda'

import IORedis from 'ioredis'


import { withRedLock } from '..'


describe('withRedLock (real Redis)', () => {
  let redisClient: IORedis

  beforeAll(async () => {
    redisClient = new IORedis()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await redisClient.quit()
  })

  it('should acquire lock and run task', async () => {
    const resource = 'test1'
    const result = await withRedLock({
      redisClient,
      resource,
      task: async () => await Promise.resolve('task-result'),
    })

    expect(result).toBe('task-result')

    const cachedResult = await redisClient.get(`redLock:${resource}:result`)
    expect(cachedResult).toBe(JSON.stringify('task-result'))

    const lock = await redisClient.get(`redLock:${resource}:lock`)
    expect(lock).toBeNull() // lock should be released
  })

  it('should return cached result if found', async () => {
    const resource = 'test2'
    // simulate another process holding the lock
    await redisClient.set(`redLock:${resource}:lock`, '1', 'PX', 10000)
    // simulate another process setting the result
    await redisClient.set(
      `redLock:${resource}:result`,
      JSON.stringify('cached-result'),
      'PX',
      10000,
    )

    const result = await withRedLock({
      redisClient,
      resource,
      task: () => {
        throw new Error('should not be called')
      },
    })

    expect(result).toBe('cached-result')
  })

  it('should poll until result is found', async () => {
    const resource = 'test3'

    // Simulate another process holding the lock
    await redisClient.set(`redLock:${resource}:lock`, '1', 'PX', 10000)

    // Schedule result write
    setTimeout(() => {
      redisClient.set(
        `redLock:${resource}:result`,
        JSON.stringify('eventual-result'),
        'PX',
        5000,
      )
    }, 200)

    const result = await withRedLock({
      redisClient,
      resource,
      task: async () => await Promise.resolve('should not run'),
      pollIntervalMs: 10,
    })

    expect(result).toBe('eventual-result')
  })

  it('should run tasks in parallel', async () => {
    const resource = 'test4'
    const promises = range(0, 100).map((idx) =>
      withRedLock({
        redisClient,
        resource,
        task: async () => await Promise.resolve(`task-result-${idx}`),
      }),
    )
    const results = await Promise.all(promises)

    for (const result of results) {
      // all tasks should use the result of the first task
      expect(result).toBe('task-result-0')
    }
    const cachedResult = await redisClient.get(`redLock:${resource}:result`)
    expect(cachedResult).toBe(JSON.stringify('task-result-0'))
    const lock = await redisClient.get(`redLock:${resource}:lock`)
    expect(lock).toBeNull() // lock should be released
  })

  it('should throw if polling times out', async () => {
    const resource = 'test5'
    // Simulate another process holding the lock
    await redisClient.set(`redLock:${resource}:lock`, '1', 'PX', 10000)

    await expect(
      withRedLock({
        redisClient,
        resource,
        task: () => {
          throw new Error('should not be called')
        },
        pollTimeoutMs: 100,
      }),
    ).rejects.toThrow(
      'Polling timed out (redLock:test5:lock: redLock:test5:result), giving up',
    )
  })

  it('should throw for JSON parse errors', async () => {
    const resource = 'test6'
    // Simulate another process holding the lock
    await redisClient.set(`redLock:${resource}:lock`, '1', 'PX', 10000)
    // Simulate another process setting an invalid result
    await redisClient.set(`redLock:${resource}:result`, 'invalid-json', 'PX', 10000)

    await expect(
      withRedLock({
        redisClient,
        resource,
        task: () => {
          throw new Error('should not be called')
        },
      }),
    ).rejects.toThrow(
      'Failed to parse result from Redis (redLock:test6:lock: redLock:test6:result)',
    )
  })
})
	