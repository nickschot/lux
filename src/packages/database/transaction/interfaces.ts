import type { Model } from '../index';

export type TransactionResult<T extends Model, U extends boolean> = T & {
  didPersist: U;
  unwrap(): T;
};
