import type { Controller$builtIn } from '../../controller';
import type { Namespace$opts } from '../namespace';

/**
 * Which relationships of a resource get relationship and related endpoints:
 * all its Serializer exposes (`true`, the default), none (`false`), or those
 * named.
 */
export type Resource$relationships = boolean | Array<string>;

export type Resource$opts = Namespace$opts & {
  only: Array<Controller$builtIn>;
  relationships?: Resource$relationships;
};
