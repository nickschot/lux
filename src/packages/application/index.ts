import { createDefaultConfig } from '../config';
import merge from '../../utils/merge';
import type Logger from '../logger';
import type Router from '../router';
import type Server from '../server';
import type Controller from '../controller';
import type Serializer from '../serializer';
import type Database from '../database';
import type { Model, ModelClass } from '../database';
import type { FreezeableMap } from '../freezeable';

import initialize from './initialize';
import type { ApplicationOptions } from './interfaces';

/**
 * A running Lumen app: its models, controllers, serializers, routes and HTTP
 * server. `app/index.js` exports a subclass, usually empty:
 *
 * ```javascript
 * import { Application } from 'lumen-framework';
 *
 * class Blog extends Application {}
 *
 * export default Blog;
 * ```
 *
 * `lumen serve` builds the app and constructs it; constructing one resolves
 * once the database is connected, every module is loaded and the server is
 * listening.
 */
class Application {
  /** The app's root directory. */
  declare path: string;

  /** The port the app listens on. */
  declare port: number;

  /**
   * A reference to the `Database` instance.
   *
   * @internal
   */
  declare store: Database;

  /**
   * A reference to the `Logger` instance.
   *
   * @internal
   */
  declare logger: Logger;

  /**
   * A reference to the `Router` instance.
   *
   * @internal
   */
  declare router: Router;

  /**
   * A reference to the `Server` instance.
   *
   * @internal
   */
  declare server: Server;

  /**
   * A map containing each `Model` class.
   *
   * @internal
   */
  declare models: FreezeableMap<string, ModelClass>;

  /**
   * A map containing each `Controller` instance.
   *
   * @internal
   */
  declare controllers: FreezeableMap<string, Controller>;

  /**
   * A map containing each `Serializer` instance.
   *
   * @internal
   */
  declare serializers: FreezeableMap<string, Serializer<Model>>;

  /**
   * Boot the app. Resolves with the ready instance, though TypeScript types
   * it as the instance itself; `await` it.
   */
  constructor(opts: ApplicationOptions) {
    // Applications construct asynchronously (see Database/Watcher); `new
    // Application()` resolves to the ready instance, and TS cannot type a
    // Promise-returning constructor.
    return initialize(
      this,
      merge(createDefaultConfig(), opts)
    ) as unknown as Application;
  }

  /**
   * Stop the application gracefully: the server stops accepting connections
   * and closes idle ones, the requests in flight finish, and then the
   * database connections close. Resolves once all of that is done.
   *
   * `lumen serve` calls it in each worker when the process is asked to stop
   * (`SIGTERM`, `SIGINT`); call it yourself when you construct an
   * application in a script or a test.
   */
  async close(): Promise<void> {
    const { server, store } = this;

    if (server.instance.listening) {
      await new Promise<void>((resolve, reject) => {
        server.instance.close(err => (err ? reject(err) : resolve()));
        // Keep-alive connections with no request in flight would otherwise
        // hold `close()` open until they time out.
        server.instance.closeIdleConnections();
      });
    }

    await store.connection.destroy();
  }
}

export default Application;
export type {
  ApplicationOptions,
  Application$Class,
  Application$factoryOpts
} from './interfaces';
