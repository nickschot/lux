import Namespace from '../namespace';
import { FreezeableSet } from '../../freezeable';
import type { Controller$builtIn } from '../../controller';

import normalizeOnly from './utils/normalize-only';
import type { Resource$opts, Resource$relationships } from './interfaces';

/** @internal */
class Resource extends Namespace {
  declare only: FreezeableSet<Controller$builtIn>;

  declare relationships: Resource$relationships;

  constructor({ only, relationships = true, ...opts }: Resource$opts) {
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

export type { Resource$opts, Resource$relationships } from './interfaces';
