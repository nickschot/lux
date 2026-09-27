import { MIME_TYPE } from '../constants';

import { parseMediaType } from './media-type';

/**
 * Whether a media type is the JSON:API media type, ignoring parameters.
 *
 * @private
 */
export default function isJSONAPI(value: string): boolean {
  return parseMediaType(value).type === MIME_TYPE;
}
