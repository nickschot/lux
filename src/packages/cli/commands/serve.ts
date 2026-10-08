import chalk from '../../../utils/chalk';
import { CWD, PORT, NODE_ENV } from '../../../constants';
import Logger from '../../logger';
import { createLoader } from '../../loader';
import { createCluster } from '../../pm';
import { watch } from '../../fs';

import { build } from './build';

/**
 * @private
 */
export async function serve({
  hot = NODE_ENV === 'development',
  cluster = false,
  useStrict = false
}: {
  hot: boolean;
  cluster: boolean;
  useStrict: boolean;
}): Promise<void> {
  const load = createLoader(CWD);
  const { logging, server } = load('config');
  const logger = new Logger(logging);

  if (hot) {
    const watcher = await watch(CWD);

    watcher.on('change', async changed => {
      await build(useStrict);
      (process as NodeJS.EventEmitter).emit('update', changed);
    });
  }

  const pm = createCluster({
    logger,
    path: CWD,
    port: PORT,
    maxWorkers: cluster ? undefined : 1,
    shutdownTimeout: server?.shutdownTimeout
  });

  let stopping = false;

  const stop = async (code: number) => {
    if (stopping) {
      return;
    }

    stopping = true;
    await pm.stop();
    logger.info('Lumen Server stopped');
    process.exit(code);
  };

  pm.once('ready', () => {
    logger.info(`Lumen Server listening on port: ${chalk.cyan(`${PORT}`)}`);
  });

  // The application could not start (or, after a crash, could not be
  // restarted): exit non-zero, so a process manager notices and acts.
  pm.on('error', (err: Error) => {
    // The worker has logged its own error; this says what it means.
    logger.error(err.message);
    stop(1);
  });

  (['SIGTERM', 'SIGINT'] as const).forEach(signal => {
    process.once(signal, () => {
      logger.info(`Received ${signal}; finishing requests in flight`);
      stop(0);
    });
  });
}
