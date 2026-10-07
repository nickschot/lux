/* eslint-disable @typescript-eslint/no-explicit-any --
 * `Application$Class` is the "class of T" type Flow spelled `Class<T>` — the
 * app-module constructors the factory helpers instantiate take arbitrary args.
 */
import type { Config } from '../config';
import type Database from '../database';
import type { DatabaseConfig, Model } from '../database';
import type Controller from '../controller';
import type Serializer from '../serializer';

export type ApplicationOptions = Config & {
  path: string;
  port: string | number;
  database: DatabaseConfig;
};

export type Application$Class<T> = new (...args: Array<any>) => T;

export type Application$factoryOpts<T extends Controller | Serializer<Model>> =
  {
    key: string;
    store: Database;
    parent?: T | null;
  };
