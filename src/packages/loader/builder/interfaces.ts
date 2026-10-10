/* eslint-disable @typescript-eslint/no-explicit-any --
 * The builder wires up app-module *classes* (arbitrary constructors) into
 * instances; `BuilderClass` is the "class of T" type Flow spelled `Class<T>`.
 */
import type { BundleNamespace, BundleNamespaceGroup } from '../index';

export type BuilderClass<T> = new (...args: Array<any>) => T;

export type NamespaceMeta<T> = {
  key: string;
  value: BundleNamespace<BuilderClass<T>>;
  parent: T | null;
};

export type ParentBuilder<T> = (
  target: BundleNamespaceGroup<BuilderClass<T>>
) => Array<NamespaceMeta<T>>;

export type ChildrenBuilder<T> = (
  target: Array<NamespaceMeta<T>>
) => Array<Array<[string, T]>>;

export type BuilderConstruct<T> = (
  key: string,
  value: BuilderClass<T>,
  parent?: T | null
) => T;
