/* eslint-disable @typescript-eslint/no-explicit-any --
 * Request query/body parsing coerces genuinely untyped input (nested arrays of
 * string values from the URL) into normalized param shapes; the `any` arrays
 * are confined to those raw-value positions.
 */
import { camelize } from 'inflection';

import { INT, NULL, BOOL, DATE, TRUE, BRACKETS } from '../constants';
import isNull from '../../../../../utils/is-null';
import entries from '../../../../../utils/entries';
import underscore from '../../../../../utils/underscore';
import { camelizeKeys } from '../../../../../utils/transform-keys';
import type { Request$method } from '../../interfaces';

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
function formatString(source: string, method: Request$method): unknown {
  if (method === 'GET') {
    if (source.indexOf(',') >= 0) {
      return source.split(',').map(str => camelize(underscore(str), true));
    } else if (INT.test(source)) {
      return Number.parseInt(source, 10);
    } else if (BOOL.test(source)) {
      return TRUE.test(source);
    } else if (NULL.test(source)) {
      return null;
    }
  }

  if (DATE.test(source)) {
    return new Date(source);
  }

  return source;
}

/**
 * @private
 */
function formatObject(
  source: Record<string, unknown> | Array<any>,
  method: Request$method,
  formatter: (
    params: Record<string, unknown>,
    method: Request$method
  ) => Record<string, unknown>
): Record<string, unknown> | Array<any> {
  if (Array.isArray(source)) {
    return source.map(value => {
      if (INT.test(value)) {
        return Number.parseInt(value, 10);
      }

      return value;
    });
  }

  return formatter(source, method);
}

/**
 * @private
 */
export function formatSort(sort: string): string {
  if (sort.startsWith('-')) {
    return `-${camelize(underscore(sort.substr(1)), true)}`;
  }

  return camelize(underscore(sort), true);
}

/**
 * @private
 */
export function formatFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  return entries(fields).reduce<Record<string, unknown>>(
    (result, [key, value]) => ({
      ...result,
      [key]: makeArray(value as string | Array<string>)
    }),
    {}
  );
}

/**
 * @private
 */
export function formatInclude(include: string | Array<string>): Array<string> {
  return makeArray(include);
}

/**
 * @private
 */
export default function format(
  params: Record<string, unknown>,
  method: Request$method
): Record<string, unknown> {
  const result = entries(params).reduce<Record<string, unknown>>(
    (obj, param) => {
      const [, value] = param;
      let [key] = param;

      key = key.replace(BRACKETS, '');

      switch (typeof value) {
        case 'object':
          return {
            ...obj,
            [key]: isNull(value)
              ? null
              : formatObject(
                  value as Record<string, unknown> | Array<any>,
                  method,
                  format
                )
          };

        case 'string':
          return {
            ...obj,
            [key]: formatString(value, key === 'id' ? 'GET' : method)
          };

        default:
          return {
            ...obj,
            [key]: value
          };
      }
    },
    {}
  );

  return camelizeKeys(result, true);
}
