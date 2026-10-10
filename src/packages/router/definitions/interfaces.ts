import type { RouterNamespace, ResourceOptions } from '../index';

export type RouterDefinitionBuilder<T extends RouterNamespace> = (
  builder: (() => void) | undefined,
  namespace: T
) => T;

export type RouterResourceArgs = [
  string,
  (ResourceOptions | null | undefined)?,
  ((() => void) | null | undefined)?
];
