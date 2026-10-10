import createGetter from './utils/create-getter';
import createSetter from './utils/create-setter';
import createNormalizer from './utils/create-normalizer';
import type { AttributeMeta } from './interfaces';

/** @internal */
export function createAttribute(opts: AttributeMeta): PropertyDescriptor {
  const normalize = createNormalizer(opts.type);
  const meta = {
    ...opts,
    normalize,
    defaultValue: normalize(opts.defaultValue)
  };

  return {
    get: createGetter(meta),
    set: createSetter(meta)
  };
}

export type { AttributeMeta } from './interfaces';
