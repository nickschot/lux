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

import chalk from '../../../utils/chalk';
import { NODE_ENV } from '../../../constants';
import { line } from '../../logger';
import omit from '../../../utils/omit';
import range from '../../../utils/range';
import type Logger from '../../logger';

import type { ClusterOptions } from './interfaces';

/**
 * How long a worker may take to start listening before it is replaced.
 */
const BOOT_TIMEOUT = 30000;

/**
 * How long a worker may take to finish its requests and exit when it is
 * shut down, before it is killed. Below the grace period of common platforms
 * (Docker's 10 s, Heroku's and Kubernetes' 30 s).
 */
const SHUTDOWN_TIMEOUT = 8000;

/**
 * Why a worker never started listening.
 *
 * @internal
 */
export class WorkerBootError extends Error {
  constructor(pid: number | undefined, reason: string) {
    super(`Worker process ${pid} failed to start: ${reason}`);
  }
}

/**
 * Forks the application's worker processes, replaces one that crashes, and
 * shuts them down gracefully.
 *
 * Emits `ready` once every worker of the initial fork is listening, and
 * `error` (with a `WorkerBootError`) when one of them fails to start instead —
 * an application that cannot boot should stop, not report it is listening.
 *
 * @internal
 */
class Cluster extends EventEmitter {
  declare path: string;

  declare port: number;

  declare logger: Logger;

  declare workers: Set<Worker>;

  declare maxWorkers: number;

  declare shutdownTimeout: number;

  /**
   * Workers being shut down on purpose (a reload or `stop()`), whose exit is
   * not a crash to replace.
   */
  declare retiring: WeakSet<Worker>;

  /** Set by `stop()`: no worker is forked or replaced any more. */
  declare stopping: boolean;

  constructor({
    path,
    port,
    logger,
    maxWorkers,
    shutdownTimeout = SHUTDOWN_TIMEOUT
  }: ClusterOptions) {
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
      },

      shutdownTimeout: {
        value: shutdownTimeout,
        writable: false,
        enumerable: true,
        configurable: false
      },

      retiring: {
        value: new WeakSet(),
        writable: false,
        enumerable: false,
        configurable: false
      },

      stopping: {
        value: false,
        writable: true,
        enumerable: false,
        configurable: false
      }
    });

    cluster.setupMaster({
      exec: joinPath(path, 'dist', 'boot.js')
    });

    process.on('update', (changed: Array<{ name: string }>) => {
      changed.forEach(({ name: filename }) => {
        logger.info(`${chalk.green('update')} ${filename}`);
      });

      this.reload();
    });

    this.forkAll().then(
      () => this.emit('ready'),
      err => {
        // Workers stopped while booting (a signal during start-up) are not a
        // failure to report.
        if (!this.stopping) {
          this.emit('error', err);
        }
      }
    );
  }

  /**
   * Fork a worker. Resolves with it once it is listening (or with `null`
   * when the cluster is full or stopping); rejects with a `WorkerBootError`
   * when it fails to start — it reports an error, exits, or does not listen
   * within `BOOT_TIMEOUT` twice in a row.
   */
  fork(retry: boolean = true): Promise<Worker | null> {
    if (this.stopping || this.workers.size >= this.maxWorkers) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const worker = cluster.fork({
        NODE_ENV,
        PORT: this.port
      });
      const { pid } = worker.process;
      let booted = false;

      const fail = (reason: string) => {
        clearTimeout(timeout);
        worker.removeAllListeners();
        worker.kill();
        this.logger.info(`Removing worker process: ${chalk.red(`${pid}`)}`);
        reject(new WorkerBootError(pid, reason));
      };

      const timeout = setTimeout(() => {
        if (retry) {
          clearTimeout(timeout);
          worker.removeAllListeners();
          worker.kill();
          this.logger.info(`Removing worker process: ${chalk.red(`${pid}`)}`);
          this.fork(false).then(resolve, reject);
        } else {
          fail(`not listening after ${BOOT_TIMEOUT / 1000} s`);
        }
      }, BOOT_TIMEOUT);

      worker.on('message', (msg: string | Record<string, any>) => {
        let data: Record<string, any> = {};
        let message = msg;

        if (typeof message === 'object') {
          data = omit(message, 'message');
          message = message.message;
        }

        switch (message) {
          case 'ready':
            booted = true;
            clearTimeout(timeout);

            this.logger.info(line`
              Adding worker process: ${chalk.green(`${pid}`)}
            `);

            this.workers.add(worker);
            resolve(worker);
            break;

          case 'error':
            if (data.error) {
              this.logger.error(data.error);
            }

            if (!booted) {
              fail('it reported an error while booting');
            }
            break;

          default:
            break;
        }
      });

      worker.once('error', (err: Error) => {
        this.logger.error(err);

        if (!booted) {
          fail(err.message);
        }
      });

      worker.once('exit', (code: number | null, signal: string | null) => {
        clearTimeout(timeout);
        worker.removeAllListeners();
        this.workers.delete(worker);

        if (!booted) {
          reject(
            new WorkerBootError(
              pid,
              `it exited with ${code === null ? signal : `code ${code}`}`
            )
          );
          return;
        }

        if (this.retiring.has(worker)) {
          return;
        }

        // A crash after a successful boot: replace the worker.
        this.logger.info(line`
          Worker process: ${chalk.red(`${pid}`)} exited with
          ${code === null ? `signal ${signal}` : `code ${code}`}
        `);

        this.logger.info(`Removing worker process: ${chalk.red(`${pid}`)}`);

        this.fork().catch(err => this.replacementFailed(err));
      });
    });
  }

  /**
   * A replacement for a crashed worker did not start. With none left, the
   * application is down: stop, so the platform can restart it.
   */
  replacementFailed(err: Error) {
    this.logger.error(err);

    if (!this.stopping && !this.workers.size) {
      this.emit('error', err);
    }
  }

  /**
   * Shut `worker` down gracefully: it stops accepting connections, finishes
   * the requests in flight, closes its database connections and exits. It is
   * killed if it has not exited after `shutdownTimeout`.
   */
  shutdown<T extends Worker>(worker: T): Promise<T> {
    return new Promise(resolve => {
      this.workers.delete(worker);
      this.retiring.add(worker);

      if (worker.isDead()) {
        resolve(worker);
        return;
      }

      const timeout = setTimeout(() => {
        this.logger.warn(line`
          Worker process: ${chalk.red(`${worker.process.pid}`)} did not exit
          within ${this.shutdownTimeout} ms; killing it.
        `);
        worker.kill('SIGKILL');
      }, this.shutdownTimeout);

      worker.once('exit', () => {
        clearTimeout(timeout);
        resolve(worker);
      });

      if (worker.isConnected()) {
        worker.send('shutdown');
      } else {
        worker.kill();
      }
    });
  }

  /**
   * Shut every worker down gracefully, booting ones included, and fork no
   * more. Resolves once all have exited.
   */
  async stop(): Promise<void> {
    this.stopping = true;

    const workers = Object.values(cluster.workers ?? {}).filter(
      (worker): worker is Worker => Boolean(worker)
    );

    await Promise.all(workers.map(worker => this.shutdown(worker)));
  }

  /**
   * Replace every worker with one running the rebuilt application, two at a
   * time. A replacement that fails to start is logged, and the cluster keeps
   * watching: saving a fix reloads again.
   */
  async reload(): Promise<void> {
    if (this.stopping) {
      return;
    }

    const workers = Array.from(this.workers);
    const failed = (err: Error) => {
      this.logger.error(`${err.message}. Save a fix to reload.`);
    };

    if (!workers.length) {
      await this.forkAll().catch(failed);
      return;
    }

    for (let i = 0; i < workers.length; i += 2) {
      await Promise.all(
        workers.slice(i, i + 2).map(async worker => {
          await this.shutdown(worker);
          await this.fork().catch(failed);
        })
      );
    }
  }

  forkAll(): Promise<Array<Worker | null>> {
    return Promise.all(
      Array.from(range(1, this.maxWorkers)).map(() => this.fork())
    );
  }
}

export default Cluster;

export type { ClusterOptions } from './interfaces';
