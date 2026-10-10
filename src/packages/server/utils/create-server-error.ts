/* eslint-disable @typescript-eslint/no-explicit-any --
 * `createServerError` wraps an arbitrary error class whose constructor accepts
 * arbitrary arguments; `new (...args: any[])` is required so that error classes
 * with any constructor signature remain assignable to `Constructor<T>`.
 */
import type { Server$Error } from '../interfaces';

type Constructor<T> = new (...args: Array<any>) => T;

/**
 * `Target`, answered with `statusCode`. `isPublic` marks a client error whose
 * message only describes the request — echoed input and declared names, never
 * stored data, SQL or internals — so it is the error's `detail` in every
 * environment. Leave it off for anything that passes on another message (a
 * database driver's, say).
 *
 * @internal
 */
export default function createServerError<T extends object>(
  Target: Constructor<T>,
  statusCode: number,
  { isPublic = false }: { isPublic?: boolean } = {}
): Constructor<T & Server$Error> {
  const ServerError = class extends (Target as Constructor<object>) {
    declare statusCode: number;

    declare isPublic: boolean;

    constructor(...args: Array<unknown>) {
      super(...args);
      this.statusCode = statusCode;
      this.isPublic = isPublic;
    }
  };

  Object.defineProperty(ServerError, 'name', {
    value: Target.name
  });

  return ServerError as unknown as Constructor<T & Server$Error>;
}
