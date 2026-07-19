/* eslint-disable @typescript-eslint/no-explicit-any --
 * `scopesFor` builds the dynamic scope-method machinery: each scope is a
 * variadic function forwarded to the model's scope statics via Reflect.apply,
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
            const fn = Reflect.get(target.model, name);
            const { snapshots } = Reflect.apply(fn, target.model, args) as {
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

          Reflect.defineProperty(scope, 'name', {
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
