import { dasherize } from 'inflection';

import underscore from '../../../utils/underscore';
import type { ServerErrorSource } from '../interfaces';

/**
 * Member names as the client sees them — responses dasherize, so pointers do
 * too (`isPublic` -> `is-public`). Escaped per RFC 6901 for use in a pointer.
 *
 * @internal
 */
function memberName(key: string): string {
  return dasherize(underscore(key));
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Map an internal parameter path to a JSON:API error `source`. Paths under
 * `data` are request document members and become a JSON Pointer
 * (`data.attributes.isPublic` -> `/data/attributes/is-public`); anything else
 * is a query parameter (`page.size` -> `page[size]`).
 *
 * @internal
 */
export default function sourceFor(path: string): ServerErrorSource {
  const [root, ...rest] = path.split('.').filter(Boolean).map(memberName);

  if (!root) {
    return {};
  } else if (root === 'data') {
    return {
      pointer: `/${[root, ...rest].map(escapePointer).join('/')}`
    };
  }

  return {
    parameter: `${root}${rest.map(key => `[${key}]`).join('')}`
  };
}

/**
 * A parameter path as the client writes it, for error messages: request
 * document members dasherized and dotted (`data.attributes.is-public`), query
 * parameters in brackets (`filter[created-at]`, `page[size]`).
 *
 * @internal
 */
export function nameFor(path: string): string {
  const [root, ...rest] = path.split('.').filter(Boolean).map(memberName);

  if (!root) {
    return '';
  } else if (root === 'data') {
    return [root, ...rest].join('.');
  }

  return `${root}${rest.map(key => `[${key}]`).join('')}`;
}

/**
 * A member name or relationship path as it appears in documents, keeping a
 * `sort` value's leading `-` (`-createdAt` -> `-created-at`,
 * `comments.user` stays dotted). Anything but a string is returned as is.
 *
 * @internal
 */
export function memberPathFor(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const descending = value.startsWith('-');
  const path = (descending ? value.slice(1) : value)
    .split('.')
    .map(memberName)
    .join('.');

  return descending ? `-${path}` : path;
}
