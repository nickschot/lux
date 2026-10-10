import type { AttributeMeta } from '../index';

import createGetter from './create-getter';
import createSetter from './create-setter';
import createNormalizer from './create-normalizer';

/** @internal */
export default function createAttribute(
  opts: AttributeMeta
): PropertyDescriptor {
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
