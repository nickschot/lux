import { DYNAMIC_PATTERN } from '../constants';
import insert from '../../../../utils/insert';

/**
 * @private
 */
export default function getDynamicSegments(path: string): Array<string> {
  const matches = path.match(DYNAMIC_PATTERN) || [];
  const dynamicSegments: Array<string> = new Array(matches.length);

  insert(
    dynamicSegments,
    matches.map(part => part.substr(1))
  );
  Object.freeze(dynamicSegments);

  return dynamicSegments;
}
