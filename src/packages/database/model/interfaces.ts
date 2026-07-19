import type Model from './index';

export type Model$Hook = (instance: Model, trx: unknown) => Promise<unknown>;

export interface Model$Hooks {
  readonly afterCreate?: Model$Hook;
  readonly afterDestroy?: Model$Hook;
  readonly afterSave?: Model$Hook;
  readonly afterUpdate?: Model$Hook;
  readonly afterValidation?: Model$Hook;
  readonly beforeCreate?: Model$Hook;
  readonly beforeDestroy?: Model$Hook;
  readonly beforeSave?: Model$Hook;
  readonly beforeUpdate?: Model$Hook;
  readonly beforeValidation?: Model$Hook;
}
