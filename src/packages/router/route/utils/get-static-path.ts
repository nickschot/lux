import { DYNAMIC_PATTERN } from '../constants';

/**
 * The route key path of `path`: each dynamic segment (`:id`) becomes
 * `:dynamic`, the form `Router#resolve()` turns request paths into. Only whole
 * segments are replaced — `/videos/:id` is `/videos/:dynamic`.
 *
 * @private
 */
export default function getStaticPath(path: string): string {
  return path.replace(DYNAMIC_PATTERN, ':dynamic');
}
