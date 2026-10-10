import type Model from '../../model';
import type { AttributeMeta } from '../index';
import isNull from '../../../../utils/is-null';
import isUndefined from '../../../../utils/is-undefined';

export default function createGetter({
  key,
  defaultValue
}: AttributeMeta): (this: Model) => unknown {
  return function getter(this: Model) {
    let value: unknown = this.currentChangeSet.get(key);

    if (isNull(value) || isUndefined(value)) {
      value = defaultValue;
    }

    return value;
  };
}
