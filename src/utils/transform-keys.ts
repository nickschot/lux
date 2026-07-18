import { camelize, dasherize } from 'inflection';

import entries from './entries';
import underscore from './underscore';

type Transformer = (key: string) => string;

/**
 * Rewrites an object's keys with `transformer`.
 *
 * Overloaded rather than Flow's `T -> T`, which was inaccurate: transforming
 * keys produces a differently-shaped object, so the object form returns
 * `Record<string, unknown>`. Arrays are passed through as a shallow copy (their
 * keys are not transformed), so they keep their element type.
 *
 * @private
 */
export function transformKeys<T>(
  source: T[],
  transformer: Transformer,
  deep?: boolean
): T[];
export function transformKeys(
  source: object,
  transformer: Transformer,
  deep?: boolean
): Record<string, unknown>;
export function transformKeys(
  source: object | unknown[],
  transformer: Transformer,
  deep: boolean = false
): object | unknown[] {
  if (Array.isArray(source)) {
    return source.slice(0);
  } else if (source && typeof source === 'object') {
    return entries(source as Record<string, unknown>)
      .reduce<Record<string, unknown>>((result, [key, value]) => {
        const recurse = deep
          && value
          && typeof value === 'object'
          && !Array.isArray(value)
          && !(value instanceof Date);

        if (recurse) {
          return {
            ...result,
            [transformer(key)]: transformKeys(
              value as object,
              transformer,
              true
            )
          };
        }

        return {
          ...result,
          [transformer(key)]: value
        };
      }, {});
  }

  return {};
}

/**
 * @private
 */
export function camelizeKeys<T>(source: T[], deep?: boolean): T[];
export function camelizeKeys(
  source: object,
  deep?: boolean
): Record<string, unknown>;
export function camelizeKeys(
  source: object | unknown[],
  deep?: boolean
): object | unknown[] {
  return transformKeys(
    source as object,
    key => camelize(underscore(key), true),
    deep
  );
}

/**
 * @private
 */
export function dasherizeKeys<T>(source: T[], deep?: boolean): T[];
export function dasherizeKeys(
  source: object,
  deep?: boolean
): Record<string, unknown>;
export function dasherizeKeys(
  source: object | unknown[],
  deep?: boolean
): object | unknown[] {
  // NOTE: the Flow original passed a second `true` argument to `dasherize`,
  // which takes only one parameter — it was silently ignored, so dropping it
  // is behaviour-preserving.
  return transformKeys(source as object, key => dasherize(underscore(key)), deep);
}

/**
 * @private
 */
export function underscoreKeys<T>(source: T[], deep?: boolean): T[];
export function underscoreKeys(
  source: object,
  deep?: boolean
): Record<string, unknown>;
export function underscoreKeys(
  source: object | unknown[],
  deep?: boolean
): object | unknown[] {
  return transformKeys(source as object, key => underscore(key), deep);
}
