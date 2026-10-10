import Namespace from '../namespace';
import { FreezeableSet } from '../../freezeable';
import type { BuiltInAction } from '../../controller';

import normalizeOnly from './utils/normalize-only';
import type { ResourceOptions, ResourceRelationships } from './interfaces';

/** @internal */
class Resource extends Namespace {
  declare only: FreezeableSet<BuiltInAction>;

  // `undefined` when the route does not say: the default depends on the
  // namespace's visibility rules (see `defineRelationships()`).
  declare relationships: ResourceRelationships | undefined;

  constructor({ only, relationships, ...opts }: ResourceOptions) {
    super(opts);

    Object.defineProperty(this, 'relationships', {
      value: Array.isArray(relationships)
        ? Object.freeze([...relationships])
        : relationships,
      writable: false,
      enumerable: false,
      configurable: false
    });

    Object.defineProperty(this, 'only', {
      value: new FreezeableSet(normalizeOnly(only)),
      writable: false,
      enumerable: false,
      configurable: false
    });

    this.only.freeze();
  }
}

export default Resource;

export type { ResourceOptions, ResourceRelationships } from './interfaces';
