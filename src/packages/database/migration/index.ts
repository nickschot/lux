import type { MigrationFn } from './interfaces';

/** @internal */
class Migration<T extends object> {
  declare fn: MigrationFn<T>;

  constructor(fn: MigrationFn<T>) {
    this.fn = fn;
  }

  run(schema: T): T {
    return this.fn(schema);
  }
}

export default Migration;
export { default as generateTimestamp } from './utils/generate-timestamp';
export type { MigrationFn } from './interfaces';
