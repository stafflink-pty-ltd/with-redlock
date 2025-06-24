"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRedLock = withRedLock;
const constants_1 = require("./constants");
async function withRedLock({ resource, task, redisClient, logger = constants_1.defaultLogger, lockTtlMs = 15000, resultTtlMs = 10000, pollIntervalMs = 100, pollTimeoutMs = 15000, }) {
    var _a, _b, _c, _d, _e;
    const log = logger;
    const lockKey = `redLock:${resource}:lock`;
    const resultKey = `redLock:${resource}:result`;
    const gotLock = await redisClient.set(lockKey, '1', 'PX', lockTtlMs, 'NX');
    if (gotLock) {
        (_a = log.debug) === null || _a === void 0 ? void 0 : _a.call(log, { lockKey }, `Lock acquired (${lockKey}), running task`);
        try {
            const result = await task();
            await redisClient.set(resultKey, JSON.stringify(result), 'PX', resultTtlMs);
            return result;
        }
        finally {
            await redisClient.del(lockKey);
            (_b = log.debug) === null || _b === void 0 ? void 0 : _b.call(log, { lockKey }, `Lock released (${lockKey})`);
        }
    }
    (_c = log.debug) === null || _c === void 0 ? void 0 : _c.call(log, { lockKey }, `Lock busy (${lockKey}), waiting for result…`);
    let raw;
    const pollStartTime = Date.now();
    do {
        const elapsedTime = Date.now() - pollStartTime;
        if (elapsedTime > pollTimeoutMs) {
            (_d = log.warn) === null || _d === void 0 ? void 0 : _d.call(log, { lockKey, resultKey }, `Polling timed out (${lockKey}: ${resultKey}), giving up`);
            throw new Error(`Polling timed out (${lockKey}: ${resultKey}), giving up`);
        }
        raw = await redisClient.get(resultKey);
        if (raw) {
            try {
                return JSON.parse(raw);
            }
            catch (err) {
                const parseErrorMsg = `Failed to parse result from Redis (${lockKey}: ${resultKey})`;
                (_e = log.error) === null || _e === void 0 ? void 0 : _e.call(log, { lockKey, resultKey, raw }, parseErrorMsg);
                throw new Error(parseErrorMsg);
            }
        }
        await new Promise(r => setTimeout(r, pollIntervalMs));
    } while (!raw);
    // unreachable
    throw new Error('Unexpected exit from polling loop');
}
