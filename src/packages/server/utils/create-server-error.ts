/* eslint-disable @typescript-eslint/no-explicit-any --
 * `createServerError` wraps an arbitrary error class whose constructor accepts
 * arbitrary arguments; `new (...args: any[])` is required so that error classes
 * with any constructor signature remain assignable to `Constructor<T>`.
 */
import type { Server$Error } from '../interfaces';

type Constructor<T> = new (...args: Array<any>) => T;

/**
 * @private
 */
export default function createServerError<T extends object>(
  Target: Constructor<T>,
  statusCode: number
): Constructor<T & Server$Error> {
  const ServerError = class extends (Target as Constructor<object>) {
    statusCode: number;

    constructor(...args: Array<unknown>) {
      super(...args);
      this.statusCode = statusCode;
    }
  };

  Reflect.defineProperty(ServerError, 'name', {
    value: Target.name
  });

  return ServerError as unknown as Constructor<T & Server$Error>;
}
