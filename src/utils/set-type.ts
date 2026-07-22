/**
 * Escape hatch that existed to coerce Flow into accepting the return type of a
 * polymorphic higher-order function.
 *
 * NOTE: this util is a Flow-era crutch. TypeScript's generics express the same
 * intent directly, so calls to `setType` should be removed as their callers are
 * converted — at which point this file can go away entirely.
 *
 * @private
 */
export default function setType<T>(fn: () => T): T {
  return fn();
}
