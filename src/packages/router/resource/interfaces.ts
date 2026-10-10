import type { BuiltInAction } from '../../controller';
import type { NamespaceOptions } from '../namespace';

/**
 * Which relationships of a resource get relationship and related endpoints:
 * all its Serializer exposes (`true`), none (`false`), or those named. The
 * default is `true` in a namespace with visibility rules, `false` in one
 * without.
 */
export type ResourceRelationships = boolean | Array<string>;

export type ResourceOptions = NamespaceOptions & {
  only: Array<BuiltInAction>;
  relationships?: ResourceRelationships;
};
