import { platform } from 'os';

const { env: ENV } = process;

export const CWD = process.cwd();

// NOTE: the Flow original derived this via a `cluster.worker.pid` check, but
// Node's `Worker` has no `pid` property — the pid lives at
// `worker.process.pid` — so `typeof worker.pid === 'number'` was always false
// and the branch never ran. It was a no-op either way: inside a worker process
// `worker.process.pid` *is* `process.pid`. Simplified rather than preserving
// dead code; behaviour is unchanged.
export const PID = process.pid;

// `ENV.PORT` is `string | undefined`; `parseInt(undefined)` yields NaN, which
// the `||` below turns into the default.
export const PORT = parseInt(ENV.PORT ?? '', 10) || 4000;
export const NODE_ENV = ENV.NODE_ENV || 'development';
export const DATABASE_URL = ENV.DATABASE_URL;
export const LUMEN_CONSOLE = ENV.LUMEN_CONSOLE || false;
export const PLATFORM = platform();
