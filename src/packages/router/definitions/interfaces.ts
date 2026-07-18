import type { Router$Namespace, Resource$opts } from '../index';

export type Router$DefinitionBuilder<T extends Router$Namespace> = (
  builder: (() => void) | undefined,
  namespace: T
) => T;

export type Router$resourceArgs = [
  string,
  (Resource$opts | null | undefined)?,
  ((() => void) | null | undefined)?
];
