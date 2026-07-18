import { ANSI } from '../constants';
import stringify from '../../../../utils/stringify';
import type { Logger$format } from '../../interfaces';

/**
 * Returns `string | undefined` because `Error#stack` is optional — the Flow
 * original had the same behaviour, it just did not say so.
 *
 * `data` is required here; Flow allowed it to be declared optional ahead of a
 * required parameter, which TypeScript does not (and every caller passes both).
 */
export default function formatMessage(
  data: unknown,
  format: Logger$format
): string | undefined {
  if (data instanceof Error) {
    return data.stack;
  } else if (format === 'json') {
    return stringify(data).replace(ANSI, '');
  }

  return stringify(data, 2);
}
