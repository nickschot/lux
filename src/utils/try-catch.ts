/**
 * The default `rescue`: swallow the error and yield `undefined`.
 *
 * This is deliberately not `K` — `K` returns `this`, which is the global
 * object when the bundle runs in sloppy mode (`lumen --use-weak`), so a failed
 * lookup like `store.modelFor()` would come back truthy.
 *
 * @private
 */
const noop = (): undefined => undefined;

/**
 * A utility function used for wrapping async code that would otherwise need a
 * try-catch block.
 *
 * V8 deoptimizes functions when running into try-catch catch due to the
 * unpredictable nature of the code. The `tryCatch` utility function is a way
 * to "have your cake and eat it too". Since the inner function (`fn`) will not
 * become deoptimized by V8 for including a standard try-catch block, we don't
 * have to sacrifice as much perf for error handling expensive computations.
 *
 * The `tryCatch` utility is also very useful when you want to perform a noop
 * when an error is thrown as the catch argument (`rescue`) is optional unlike
 * a traditional try-catch block.
 *
 * @example
 * tryCatch(() => {
 *   const n = Math.floor(Math.random() * 6);
 *
 *   if (n >= 4) {
 *     throw new Error('You lose!');
 *   } else {
 *     return Promise.resolve(n);
 *   }
 * }, err => {
 *   console.error(err);
 * }).then(luckyNumber => {
 *   console.log(`Your lucky number is ${luckyNumber}.`);
 * });
 *
 * @private
 */
export default async function tryCatch<T>(
  fn: () => Promise<T>,
  rescue: (err: unknown) => unknown = noop
): Promise<T | undefined> {
  let result: T | undefined;

  try {
    result = await fn();
  } catch (err) {
    // `rescue` is a caller-supplied handler with no contract on its return
    // value; when it returns something meaningful it stands in for `fn`'s.
    result = (await rescue(err)) as T | undefined;
  }

  return result;
}

/**
 * A syncronous implementation of the `tryCatch` utility.
 *
 * @example
 * const luckyNumber = tryCatchSync(() => {
 *   const n = Math.floor(Math.random() * 6);
 *
 *   if (n >= 4) {
 *     throw new Error('You lose!');
 *   } else {
 *     return n;
 *   }
 * }, err => {
 *   console.error(err);
 * });
 *
 * if (luckyNumber) {
 *   console.log(`Your lucky number is ${luckyNumber}.`);
 * }
 *
 * @private
 */
export function tryCatchSync<T>(
  fn: () => T,
  rescue: (err: unknown) => unknown = noop
): T | undefined {
  let result: T | undefined;

  try {
    result = fn();
  } catch (err) {
    result = rescue(err) as T | undefined;
  }

  return result;
}
