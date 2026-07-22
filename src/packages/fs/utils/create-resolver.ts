/* eslint-disable @typescript-eslint/no-explicit-any --
 * Adapts Node's error-first callbacks to Promise settlers; the resolved data
 * varies by fs operation (Stats, string[], Buffer, void), so it is `any` at
 * this adapter boundary.
 */

/**
 * @private
 */
export default function createResolver(
  resolve: (data: any) => void,
  reject: (err: Error) => void
): (err: Error | null, ...args: Array<any>) => void {
  return function fsResolver(err: Error | null, ...args: Array<any>) {
    const [data] = args;

    if (err) {
      reject(err);
      return;
    }

    resolve(args.length > 1 ? args : data);
  };
}
