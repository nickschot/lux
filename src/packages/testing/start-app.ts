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
   * defaults it to `'test'` when unset, until `close()` restores it.
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
  /**
   * Stops the server, closes the database connections, and restores
   * `NODE_ENV` to what it was before `startApp()`.
   */
  close: () => Promise<void>;
};

type Bundle = {
  Application: new (options: Record<string, unknown>) => Promise<Application>;
  config: Record<string, unknown>;
  database: Record<string, unknown>;
};

// The bundles booting or booted in this process. Booting sets up an app's
// model classes, which happens once per process: a second boot of the same
// bundle fails. A failed boot is removed again, so a retry reports its own
// error rather than "already started".
const started = new Set<string>();

// The first error each bundle failed to boot with: a failed boot can leave the
// app half set up, so a retry may fail on that rather than on the cause.
const failed = new Map<string, unknown>();

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
 * the same one again throws. `NODE_ENV` holds the app's environment until
 * `close()`.
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

  // Read when the bundle loads, which is why it is set first. It stays set
  // while the app runs: the app reads it again per request (whether a 500
  // shows its message).
  const previous = process.env.NODE_ENV;
  const restoreEnv = () => {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  };

  process.env.NODE_ENV = env ?? previous ?? 'test';
  started.add(bundlePath);

  let app: Application;

  try {
    // The app's bundle, resolved at runtime: not a module of the framework.
    const {
      Application: App,
      config,
      database
    } = createRequire(bundlePath)(bundlePath) as Bundle;

    app = await new App({ ...config, database, path: root, port });

    if (!app.server.instance.listening) {
      await once(app.server.instance, 'listening');
    }
  } catch (error) {
    started.delete(bundlePath);
    restoreEnv();

    const earlier = failed.get(bundlePath);

    if (failed.has(bundlePath)) {
      throw new Error(
        `startApp: booting ${root} failed: ${messageOf(error)}. An earlier ` +
          `attempt in this process failed first, with: ${messageOf(earlier)}. ` +
          'A failed boot can leave the app half set up: fix that one first.',
        { cause: error }
      );
    }

    failed.set(bundlePath, error);
    throw error;
  }

  const { port: listening } = app.server.instance.address() as AddressInfo;

  return {
    app,
    origin: `http://localhost:${listening}`,
    close: async () => {
      try {
        await app.close();
      } finally {
        restoreEnv();
      }
    }
  };
}
