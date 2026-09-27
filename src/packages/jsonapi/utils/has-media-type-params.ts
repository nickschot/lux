import { parseMediaType } from './media-type';

/**
 * Whether a media type (e.g. a `Content-Type` value) carries parameters.
 *
 * @private
 */
export default function hasMediaTypeParams(value: string): boolean {
  return parseMediaType(value).params.length > 0;
}
