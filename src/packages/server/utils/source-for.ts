import { dasherize } from 'inflection';

import underscore from '../../../utils/underscore';
import type { Server$ErrorSource } from '../interfaces';

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
export default function sourceFor(path: string): Server$ErrorSource {
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
