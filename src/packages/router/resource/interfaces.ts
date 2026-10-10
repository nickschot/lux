import type { BuiltInAction } from '../../controller';
import type { NamespaceOptions } from '../namespace';

/**
 * Which relationships of a resource get relationship and related endpoints:
 * all its Serializer exposes (`true`, the default), none (`false`), or those
 * named.
 */
export type ResourceRelationships = boolean | Array<string>;

export type ResourceOptions = NamespaceOptions & {
  only: Array<BuiltInAction>;
  relationships?: ResourceRelationships;
};
