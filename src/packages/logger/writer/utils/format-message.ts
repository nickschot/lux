import { stripVTControlCharacters } from 'util';

import stringify from '../../../../utils/stringify';
import type { LogFormat } from '../../interfaces';

/**
 * Returns `string | undefined` because `Error#stack` is optional — the Flow
 * original had the same behaviour, it just did not say so.
 *
 * `data` is required here; Flow allowed it to be declared optional ahead of a
 * required parameter, which TypeScript does not (and every caller passes both).
 */
export default function formatMessage(
  data: unknown,
  format: LogFormat
): string | undefined {
  if (data instanceof Error) {
    return data.stack;
  } else if (format === 'json') {
    return stripVTControlCharacters(stringify(data));
  }

  return stringify(data, 2);
}
