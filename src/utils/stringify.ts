import isObject from './is-object';

/**
 * @private
 */
export default function stringify(value?: unknown, spaces?: number): string {
  if (isObject(value) || Array.isArray(value)) {
    return JSON.stringify(value, null, spaces);
  }

  return String(value);
}
