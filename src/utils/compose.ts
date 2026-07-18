/* eslint-disable @typescript-eslint/no-explicit-any --
 * The intermediate stages of a composed pipeline are genuinely untyped: only
 * the pipeline's input and output are knowable without full variadic typing,
 * which would cost far more than it buys for an internal helper. The `any`s
 * are confined to those intermediate positions — the exported signatures keep
 * precise `T` -> `U` types.
 */

/**
 * A single stage of a composed pipeline.
 *
 * @private
 */
type Stage = (value: any) => any;

/**
 * @private
 */
export function tap<T>(input: T): T {
  console.log(input);
  return input;
}

/**
 * @private
 */
export function compose<T, U>(
  main: (input: any) => U,
  ...etc: Stage[]
): (input: T) => U {
  return input => main(etc.reduceRight<any>((value, fn) => fn(value), input));
}

/**
 * @private
 */
export function composeAsync<T, U>(
  main: (input: any) => Promise<U>,
  ...etc: Stage[]
): (input: T | Promise<T>) => Promise<U> {
  return input =>
    etc
      .reduceRight<Promise<any>>(
        (value, fn) => Promise.resolve(value).then(fn),
        Promise.resolve(input)
      )
      .then(main);
}
