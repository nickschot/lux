import type { Model } from '../index';

/**
 * What a write (`create`, `update`, `save`, `destroy`) resolves with: the
 * record, with two extra members.
 */
export type TransactionResult<T extends Model, U extends boolean> = T & {
  /** Whether the write changed anything in the database. */
  didPersist: U;

  /** The record itself, without these members. */
  unwrap(): T;
};
