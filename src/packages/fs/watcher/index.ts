import EventEmitter from 'events';
import type { FSWatcher } from 'fs';

import { Client } from 'fb-watchman';

import initialize from './initialize';

/**
 * @private
 */
class Watcher extends EventEmitter {
  declare path: string;

  declare client: Client | FSWatcher;

  constructor(path: string, useWatchman: boolean = true) {
    super();
    // Watchers initialize asynchronously; `initialize` populates `this` and
    // resolves once the watchman/native watcher is wired up, so `new Watcher()`
    // is awaited by callers. TS can't type a Promise-returning constructor.
    return initialize(this, path, useWatchman) as unknown as Watcher;
  }

  destroy() {
    const { client } = this;

    if (client instanceof Client) {
      client.end();
    } else {
      client.close();
    }
  }
}

export default Watcher;
