import { SimpleLogger } from './types'

export const defaultLogger: SimpleLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
