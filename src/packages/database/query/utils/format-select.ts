import { camelize } from 'inflection';

import type { ModelClass } from '../../interfaces';

/** @internal */
export default function formatSelect(
  model: ModelClass,
  attrs: Array<string> = [],
  prefix: string = ''
) {
  return attrs.map(attr => {
    const name = model.columnNameFor(attr) || 'undefined';

    return `${model.tableName}.${name} AS ${prefix}${camelize(name, true)}`;
  });
}
