import type Query from '../index';

export const RUNNERS: WeakMap<
  Query<unknown>,
  () => Promise<void>
> = new WeakMap();
