import isObject from '../../../../../utils/is-object';
import type { Request } from '../../interfaces';

import parseNestedObject from './parse-nested-object';
import format, { formatSort, formatFields, formatInclude } from './format';

/**
 * @private
 */
export default function parseRead({
  url: { query }
}: Request): Record<string, unknown> {
  const { sort, fields, include, ...params } = parseNestedObject(query);

  if (sort) {
    params.sort = typeof sort === 'string' ? formatSort(sort) : sort;
  }

  if (fields && !isObject(fields)) {
    params.fields = fields;
  }

  if (include) {
    params.include = formatInclude(include as string | Array<string>);
  }

  const result = format(params);

  // Added after `format()`, whose key camelizing would rewrite resource types
  // (`fields[blog-posts]` -> `blogPosts`).
  if (isObject(fields)) {
    result.fields = formatFields(fields);
  }

  return result;
}
