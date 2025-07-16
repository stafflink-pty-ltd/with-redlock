# with-redlock

Lock an operation with redis. Uses a very simple implementation with a lock key and a result key. Use this function when multiple processes are attempting to do the same operation.

Install via Yarn:

```bash
yarn add with-redlock
```

Install via npm:

```bash
npm install --save with-redlock
```

# Usage

```javascript
import { createLogger, type Logger } from '@redwoodjs/api/logger'

import IORedis from 'ioredis'
import { deleteTable } from '.'
import { withRedLock } from 'with-redlock'

const logger = createLogger({})
const redisClient = new IORedis()

const deleteTableWithLock = (tableId: number) => {
  return withRedLock({
    redisClient,
    resource: `deleteTableWithLock:${tableId}`,
    task: async () => {
      const result = await deleteTable(tableId)
      return result
    },
    logger,
  })
}
```

## Contributing

We welcome issues and pull requests!

- [Report bugs or request features](https://github.com/stafflink-pty-ltd/with-redlock/issues)
- [Submit Pull Requests](https://github.com/stafflink-pty-ltd/with-redlock/pulls)

## License

MIT © 2025 Regan Smith
