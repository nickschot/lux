/* eslint-disable @typescript-eslint/no-explicit-any --
 * The builder wires up app-module *classes* (arbitrary constructors) into
 * instances; `Builder$Class` is the "class of T" type Flow spelled `Class<T>`.
 */
import type { Bundle$Namespace, Bundle$NamespaceGroup } from '../index';

export type Builder$Class<T> = new (...args: Array<any>) => T;

export type Builder$NamespaceMeta<T> = {
  key: string;
  value: Bundle$Namespace<Builder$Class<T>>;
  parent: T | null;
};

export type Builder$ParentBuilder<T> = (
  target: Bundle$NamespaceGroup<Builder$Class<T>>
) => Array<Builder$NamespaceMeta<T>>;

export type Builder$ChildrenBuilder<T> = (
  target: Array<Builder$NamespaceMeta<T>>
) => Array<Array<[string, T]>>;

export type Builder$Construct<T> = (
  key: string,
  value: Builder$Class<T>,
  parent?: T | null
) => T;
