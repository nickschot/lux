import type Model from '../index';

// A model's attributes and relationships are installed as accessors from the
// app's schema at runtime, so `Model` has no static type for them — and an index
// signature would turn every typo on a model into a silent `unknown`. Dynamic
// access by name goes through these two functions instead, which keep the one
// cast it needs in one place.

/**
 * Read an attribute (or relationship) of `record` by name.
 *
 * @internal
 */
export function readAttribute(record: Model, key: string): unknown {
  return (record as unknown as Record<string, unknown>)[key];
}

/**
 * Write an attribute (or relationship) of `record` by name. Unlike
 * `Reflect.set`, a failed write throws rather than returning `false`.
 *
 * @internal
 */
export function writeAttribute(record: Model, key: string, value: unknown) {
  (record as unknown as Record<string, unknown>)[key] = value;
}
