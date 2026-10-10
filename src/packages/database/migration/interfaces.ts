/** @internal */
export type MigrationFn<T extends object> = (schema: T) => T;
