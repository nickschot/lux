import type Model from './index';

export type ModelHook = (instance: Model, trx: unknown) => Promise<unknown>;

export interface ModelHooks {
  readonly afterCreate?: ModelHook;
  readonly afterDestroy?: ModelHook;
  readonly afterSave?: ModelHook;
  readonly afterUpdate?: ModelHook;
  readonly afterValidation?: ModelHook;
  readonly beforeCreate?: ModelHook;
  readonly beforeDestroy?: ModelHook;
  readonly beforeSave?: ModelHook;
  readonly beforeUpdate?: ModelHook;
  readonly beforeValidation?: ModelHook;
}
