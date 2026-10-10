import { once } from 'events';
import { createRequire } from 'module';
import { resolve as resolvePath, join as joinPath } from 'path';
import type { AddressInfo } from 'net';

import type Application from '../application';

/** The options of {@link startApp}. */
export type StartAppOptions = {
  /**
   * The environment to boot in: which `config/environments/*.js` and which
   * entry of `config/database.js` apply. Sets `NODE_ENV` when given, and
   * defaults it to `'test'` when unset.
   */
  env?: string;

  /** The port to listen on. `0`, the default, takes a free one. */
  port?: number;
};

/** An application {@link startApp} booted. */
export type StartedApp = {
  /** The application, for {@link auditVisibility} and the models. */
  app: Application;
  /** Where it listens, such as `'http://localhost:53017'`. */
  origin: string;
  /** Stops the server and closes the database connections. */
  close: () => Promise<void>;
};

type Bundle = {
  Application: new (options: Record<string, unknown>) => Promise<Application>;
  config: Record<string, unknown>;
  database: Record<string, unknown>;
};

// The bundles booted in this process. Booting sets up an app's model classes,
// which happens once per process: a second boot of the same bundle fails.
const started = new Set<string>();

/**
 * Boot the app at `path` in the test's own process, from its compiled
 * bundle (`dist/bundle.js`), and listen on a free port.
 *
 * ```javascript
 * import { startApp } from 'lumen-framework/testing';
 *
 * let app, origin, close;
 *
 * beforeAll(async () => {
 *   ({ app, origin, close } = await startApp(process.cwd()));
 * });
 *
 * afterAll(() => close());
 * ```
 *
 * The bundle must be compiled for the environment first, as `lumen build`
 * and the `lumen db:*` commands do. Its model classes are set up once per
 * process, so start an app once and share it between test files; starting
 * the same one again throws.
 *
 * @param path - The app's root directory.
 * @param options - The environment and port.
 * @returns The application, where it listens, and how to stop it.
 * @throws When the app at `path` was already started in this process.
 */
export default async function startApp(
  path: string,
  { env, port = 0 }: StartAppOptions = {}
): Promise<StartedApp> {
  const root = resolvePath(path);
  const bundlePath = joinPath(root, 'dist', 'bundle.js');

  if (started.has(bundlePath)) {
    throw new Error(
      `startApp: ${root} was already started in this process. Its models ` +
        'are set up once per process: start it once and share it.'
    );
  }

  // Read when the bundle loads, which is why it is set first.
  if (env) {
    process.env.NODE_ENV = env;
  } else {
    process.env.NODE_ENV ??= 'test';
  }

  started.add(bundlePath);

  // The app's bundle, resolved at runtime: not a module of the framework.
  const {
    Application: App,
    config,
    database
  } = createRequire(bundlePath)(bundlePath) as Bundle;

  const app = await new App({ ...config, database, path: root, port });
  const { instance } = app.server;

  if (!instance.listening) {
    await once(instance, 'listening');
  }

  const { port: listening } = instance.address() as AddressInfo;

  return {
    app,
    origin: `http://localhost:${listening}`,
    close: () => app.close()
  };
}
