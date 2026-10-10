import type { BuiltInAction } from './index';

export const BUILT_IN_ACTIONS: ReadonlyArray<BuiltInAction> = Object.freeze([
  'show',
  'index',
  'create',
  'update',
  'destroy'
]);

/**
 * Settings a controller takes from its namespace's `ApplicationController`
 * (and that one from its parent namespace's) unless it sets them itself.
 */
export const NAMESPACE_SETTINGS = [
  'rejectUnlistedAttributes',
  'rejectUnlistedRelationships',
  'maxIncludeDepth'
] as const;
