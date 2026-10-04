/* eslint-disable @typescript-eslint/no-explicit-any --
 * Query parsing coerces genuinely untyped input (nested arrays of string
 * values from the URL) into normalized param shapes; the `any` arrays are
 * confined to those raw-value positions.
 */
import { camelize } from 'inflection';

import { INT, NULL, BOOL, DATE, TRUE, BRACKETS } from '../constants';
import isNull from '../../../../../utils/is-null';
import entries from '../../../../../utils/entries';
import underscore from '../../../../../utils/underscore';
import { camelizeKeys } from '../../../../../utils/transform-keys';

/**
 * A member name as the client writes it (`created-at`) in its internal form
 * (`createdAt`).
 *
 * @private
 */
function memberName(name: string): string {
  return camelize(underscore(name), true);
}

/**
 * @private
 */
function makeArray(source: string | Array<string>): Array<string> {
  if (!Array.isArray(source)) {
    return source.includes(',') ? source.split(',') : [source];
  }

  return source;
}

/**
 * @private
 */
function formatScalar(source: unknown): unknown {
  if (typeof source !== 'string') {
    return source;
  } else if (INT.test(source)) {
    return Number.parseInt(source, 10);
  } else if (BOOL.test(source)) {
    return TRUE.test(source);
  } else if (NULL.test(source)) {
    return null;
  } else if (DATE.test(source)) {
    return new Date(source);
  }

  return source;
}

/**
 * A query parameter's value. A comma-separated list becomes an array
 * (`filter[id]=1,2` matches either). Values are data: unlike member names,
 * they are never camelized.
 *
 * @private
 */
function formatValue(source: string): unknown {
  if (source.includes(',')) {
    return source.split(',').map(formatScalar);
  }

  return formatScalar(source);
}

/**
 * @private
 */
export function formatSort(sort: string): string {
  if (sort.startsWith('-')) {
    return `-${memberName(sort.substr(1))}`;
  }

  return memberName(sort);
}

/**
 * @private
 */
export function formatFields(
  fields: Record<string, unknown>
): Record<string, Array<string>> {
  // Keys are resource types and stay as written; values are member names,
  // camelized like `sort` (`created-at` -> `createdAt`). An empty value is an
  // empty fieldset, which the spec defines as "no fields".
  return entries(fields).reduce<Record<string, Array<string>>>(
    (result, [key, value]) => ({
      ...result,
      [key]: makeArray(value as string | Array<string>)
        .filter(Boolean)
        .map(memberName)
    }),
    {}
  );
}

/**
 * Relationship paths, with each member name camelized
 * (`comments.blog-author` -> `comments.blogAuthor`).
 *
 * @private
 */
export function formatInclude(include: string | Array<string>): Array<string> {
  return makeArray(include).map(path =>
    path.split('.').map(memberName).join('.')
  );
}

/**
 * Format query parameters: keys are camelized (they are member names, e.g.
 * `filter[is-public]`), values are coerced (`123`, `true`, `null`, ISO dates)
 * and split on commas, but otherwise left as written.
 *
 * @private
 */
export default function format(
  params: Record<string, unknown>
): Record<string, unknown> {
  const result = entries(params).reduce<Record<string, unknown>>(
    (obj, [key, value]) => {
      const name = key.replace(BRACKETS, '');

      if (Array.isArray(value)) {
        return { ...obj, [name]: value.map(formatScalar) };
      } else if (value && typeof value === 'object') {
        return { ...obj, [name]: format(value as Record<string, any>) };
      } else if (typeof value === 'string') {
        return { ...obj, [name]: formatValue(value) };
      }

      return { ...obj, [name]: isNull(value) ? null : value };
    },
    {}
  );

  return camelizeKeys(result, true);
}
