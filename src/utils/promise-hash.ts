import entries from './entries';

/**
 * Resolves every value of an object, returning an object of the same shape with
 * each promise unwrapped.
 *
 * @private
 */
export default function promiseHash<T extends Record<string, unknown>>(
  promises: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  type Resolved = { [K in keyof T]: Awaited<T[K]> };

  if (Object.keys(promises).length) {
    return Promise.all(
      entries(promises)
        .map(([key, promise]) => (
          new Promise<Record<string, unknown>>((resolve, reject) => {
            const maybe = promise as Promise<unknown> | undefined;

            if (maybe && typeof maybe.then === 'function') {
              maybe
                .then(value => resolve({ [key]: value }))
                .catch(reject);
            } else {
              resolve({ [key]: promise });
            }
          })
        ))
    ).then(objects => objects.reduce((hash, object) => ({
      ...hash,
      ...object
    }), {}) as Resolved);
  }

  return Promise.resolve({} as Resolved);
}
