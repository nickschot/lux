/* eslint-disable @typescript-eslint/no-explicit-any --
 * The loader resolves app modules (controllers, models, serializers) by name at
 * runtime; their concrete types aren't known here, so `Loader` yields `any` (as
 * it did in Flow).
 */
import type { FreezeableMap } from '../freezeable';

export type Loader = (type: string) => any;
export type Bundle$Namespace<T> = FreezeableMap<string, T>;
export type Bundle$NamespaceGroup<T> = FreezeableMap<
  string,
  Bundle$Namespace<T>
>;
