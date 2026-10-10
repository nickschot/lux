import { FreezeableMap } from '../../freezeable';
import { resolve } from '../resolver';
import chain from '../../../utils/chain';
import type { BundleNamespace } from '../index';

import createParentBuilder from './utils/create-parent-builder';
import createChildrenBuilder from './utils/create-children-builder';
import type { BuilderClass, BuilderConstruct } from './interfaces';

/**
 * @private
 */
export function build<T>(
  group: BundleNamespace<BuilderClass<T>>,
  construct: BuilderConstruct<T>
): BundleNamespace<T> {
  return chain(group)
    .pipe(resolve)
    .pipe(createParentBuilder(construct))
    .pipe(createChildrenBuilder(construct))
    .pipe(arr =>
      arr.reduce<Array<[string, T]>>(
        (result, value) => [...result, ...value],
        []
      )
    )
    .pipe(pairs => new FreezeableMap(pairs))
    .value();
}
