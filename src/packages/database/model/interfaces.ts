import type Model from './index';

/**
 * A model lifecycle hook: called with the record and the write's
 * transaction. See {@link Model.hooks}.
 */
export type ModelHook = (instance: Model, trx: unknown) => Promise<unknown>;

/**
 * The hooks a model declares in {@link Model.hooks}, by the point in a
 * record's life they run at.
 */
export interface ModelHooks {
  /** After a record is inserted, in its transaction. */
  readonly afterCreate?: ModelHook;

  /** After a record is deleted, in its transaction. */
  readonly afterDestroy?: ModelHook;

  /** After a record is inserted or updated; last. */
  readonly afterSave?: ModelHook;

  /** After a record is updated, in its transaction. */
  readonly afterUpdate?: ModelHook;

  /** After the record's validations pass. */
  readonly afterValidation?: ModelHook;

  /** Before a record is inserted, after validation. */
  readonly beforeCreate?: ModelHook;

  /** Before a record is deleted. */
  readonly beforeDestroy?: ModelHook;

  /** Before a record is inserted or updated; last before the write. */
  readonly beforeSave?: ModelHook;

  /** Before a record is updated, after validation. */
  readonly beforeUpdate?: ModelHook;

  /** Before the record's validations run, on create and update. */
  readonly beforeValidation?: ModelHook;
}
