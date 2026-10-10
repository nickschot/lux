/* eslint-disable @typescript-eslint/no-explicit-any --
 * `ApplicationClass` is the "class of T" type Flow spelled `Class<T>` — the
 * app-module constructors the factory helpers instantiate take arbitrary args.
 */
import type { Config } from '../config';
import type Database from '../database';
import type { DatabaseConfig, Model } from '../database';
import type Controller from '../controller';
import type Serializer from '../serializer';

/**
 * What an {@link Application} is constructed with: the environment's
 * {@link Config}, plus where the app is and how to reach its database. The
 * app's generated boot code passes these; apps don't build them by hand.
 */
export type ApplicationOptions = Config & {
  /** The app's root directory. */
  path: string;

  /** The port to listen on. */
  port: string | number;

  /** The contents of `config/database.js`. */
  database: DatabaseConfig;
};

export type ApplicationClass<T> = new (...args: Array<any>) => T;

export type ApplicationFactoryOptions<
  T extends Controller | Serializer<Model>
> = {
  key: string;
  store: Database;
  parent?: T | null;
};
