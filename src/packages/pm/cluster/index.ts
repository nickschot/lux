/* eslint-disable @typescript-eslint/no-explicit-any --
 * The cluster manager talks to worker processes over Node's untyped IPC
 * channel: the `update` process event and worker `message` payloads carry
 * arbitrary data, so those values are genuinely untyped here (as they were
 * `Object` in Flow).
 */
import EventEmitter from 'events';
import os from 'os';
import cluster, { type Worker } from 'cluster';
import { join as joinPath } from 'path';

import { red, green } from 'chalk';

import { NODE_ENV } from '../../../constants';
import { line } from '../../logger';
import omit from '../../../utils/omit';
import range from '../../../utils/range';
import { composeAsync } from '../../../utils/compose';
import type Logger from '../../logger';

import type { Cluster$opts } from './interfaces';

/**
 * @private
 */
class Cluster extends EventEmitter {
  declare path: string;

  declare port: number;

  declare logger: Logger;

  declare workers: Set<Worker>;

  declare maxWorkers: number;

  constructor({ path, port, logger, maxWorkers }: Cluster$opts) {
    super();

    Object.defineProperties(this, {
      path: {
        value: path,
        writable: false,
        enumerable: true,
        configurable: false
      },

      port: {
        value: port,
        writable: false,
        enumerable: true,
        configurable: false
      },

      logger: {
        value: logger,
        writable: false,
        enumerable: true,
        configurable: false
      },

      workers: {
        value: new Set(),
        writable: false,
        enumerable: true,
        configurable: false
      },

      maxWorkers: {
        value: maxWorkers || os.cpus().length,
        writable: false,
        enumerable: true,
        configurable: false
      }
    });

    cluster.setupMaster({
      exec: joinPath(path, 'dist', 'boot.js')
    });

    process.on('update', (changed: Array<{ name: string }>) => {
      changed.forEach(({ name: filename }) => {
        logger.info(`${green('update')} ${filename}`);
      });

      this.reload();
    });

    this.forkAll().then(() => this.emit('ready'));
  }

  fork(retry: boolean = true): Promise<Worker> {
    return new Promise(resolve => {
      if (this.workers.size < this.maxWorkers) {
        const worker = cluster.fork({
          NODE_ENV,
          PORT: this.port
        });

        const timeout = setTimeout(() => {
          this.logger.info(line`
            Removing worker process: ${red(`${worker.process.pid}`)}
          `);

          clearTimeout(timeout);

          worker.removeAllListeners();
          worker.kill();

          this.workers.delete(worker);

          resolve(worker);

          if (retry) {
            this.fork(false);
          }
        }, 30000);

        const handleError = (err?: any) => {
          if (err) {
            this.logger.error(err);
          }

          this.logger.info(line`
            Removing worker process: ${red(`${worker.process.pid}`)}
          `);

          clearTimeout(timeout);

          worker.removeAllListeners();
          worker.kill();

          this.workers.delete(worker);

          resolve(worker);
        };

        worker.on('message', (msg: string | Record<string, any>) => {
          let data: Record<string, any> = {};
          let message = msg;

          if (typeof message === 'object') {
            data = omit(message, 'message');
            message = message.message;
          }

          switch (message) {
            case 'ready':
              this.logger.info(line`
                Adding worker process: ${green(`${worker.process.pid}`)}
              `);

              this.workers.add(worker);

              clearTimeout(timeout);
              worker.removeListener('error', handleError);

              resolve(worker);
              break;

            case 'error':
              handleError(data.error);
              break;

            default:
              break;
          }
        });

        worker.once('error', handleError);
        worker.once('exit', (code: number | null) => {
          const {
            process: { pid }
          } = worker;

          if (typeof code === 'number') {
            this.logger.info(line`
              Worker process: ${red(`${pid}`)} exited with code ${code}
            `);
          }

          this.logger.info(`Removing worker process: ${red(`${pid}`)}`);

          clearTimeout(timeout);

          worker.removeAllListeners();
          this.workers.delete(worker);

          this.fork();
        });
      }
    });
  }

  shutdown<T extends Worker>(worker: T): Promise<T> {
    return new Promise(resolve => {
      this.workers.delete(worker);

      const timeout = setTimeout(() => worker.kill(), 5000);

      worker.once('disconnect', () => {
        worker.kill();
      });

      worker.once('exit', () => {
        resolve(worker);
        clearTimeout(timeout);
      });

      worker.send('shutdown');
      worker.disconnect();
    });
  }

  reload() {
    if (this.workers.size) {
      const groups = Array.from(this.workers).reduce<
        Array<() => Promise<Array<Worker>>>
      >((arr, item, idx, src) => {
        if ((idx + 1) % 2) {
          const group = src.slice(idx, idx + 2);

          return [
            ...arr,
            () => Promise.all(group.map(worker => this.shutdown(worker)))
          ];
        }

        return arr;
      }, []);

      // groups is non-empty here (guarded by workers.size); composeAsync's
      // fixed-first-param signature can't be spread with a dynamic array.
      return (composeAsync as any)(...groups)();
    }

    return this.fork();
  }

  forkAll() {
    return Promise.race(
      Array.from(range(1, this.maxWorkers)).map(() => this.fork())
    );
  }
}

export default Cluster;

export type { Cluster$opts } from './interfaces';
