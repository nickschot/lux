/* eslint-disable @typescript-eslint/no-explicit-any --
 * `scopesFor` builds the dynamic scope-method machinery: each scope is a
 * variadic function forwarded to the model's scope statics via `apply`,
 * so the argument list is genuinely untyped at this layer.
 */
import type Query from '../index';

export default function scopesFor<T>(target: Query<T>): PropertyDescriptorMap {
  return Object.keys(target.model.scopes).reduce<PropertyDescriptorMap>(
    (scopes, name) => ({
      ...scopes,
      [name]: {
        get() {
          const scope = function (...args: Array<any>) {
            // Scopes are installed as statics on the model under their names.
            const fn = (
              target.model as unknown as Record<
                string,
                (...a: any[]) => unknown
              >
            )[name];
            const { snapshots } = fn.apply(target.model, args) as {
              snapshots: Array<Array<unknown>>;
            };

            Object.assign(target, {
              snapshots: [
                ...target.snapshots,
                ...snapshots.map(snapshot => [...snapshot, name])
              ]
            });

            return target;
          };

          Object.defineProperty(scope, 'name', {
            value: name,
            writable: false,
            enumerable: false,
            configurable: false
          });

          return scope;
        }
      }
    }),
    {}
  );
}
