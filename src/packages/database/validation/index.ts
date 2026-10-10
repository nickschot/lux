import type { ValidationOptions } from './interfaces';

/** @internal */
class Validation<T> {
  declare key: string;

  declare value: T;

  declare validator: (value?: T) => boolean;

  constructor(opts: ValidationOptions<T>) {
    Object.defineProperties(this, {
      key: {
        value: opts.key,
        writable: false,
        enumerable: true,
        configurable: false
      },

      value: {
        value: opts.value,
        writable: false,
        enumerable: true,
        configurable: false
      },

      validator: {
        value: opts.validator,
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
  }

  isValid(): boolean {
    return this.validator(this.value);
  }
}

export default Validation;
export { ValidationError } from './errors';
