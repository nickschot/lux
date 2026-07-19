import type { Model } from '../index';

export type Transaction$ResultProxy<T extends Model, U extends boolean> = T & {
  didPersist: U;
  unwrap(): T;
};
