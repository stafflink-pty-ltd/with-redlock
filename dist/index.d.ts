import { WithRedLockParams } from './types';
export type { WithRedLockParams } from './types';
export declare function withRedLock<T>({ resource, task, redisClient, logger, lockTtlMs, resultTtlMs, pollIntervalMs, pollTimeoutMs, }: WithRedLockParams<T>): Promise<T>;
