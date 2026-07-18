/**
 * A single stage of a composed pipeline. The intermediate stages are
 * intentionally loose: only the pipeline's input and output types are knowable
 * without full variadic typing, and expressing that here would cost more than
 * it buys for an internal helper.
 *
 * @private
 */
type Stage = (value: any) => any;

/**
 * @private
 */
export function tap<T>(input: T): T {
  console.log(input); // eslint-disable-line no-console
  return input;
}

/**
 * @private
 */
export function compose<T, U>(
  main: (input: any) => U,
  ...etc: Stage[]
): (input: T) => U {
  return input => main(etc.reduceRight<any>(
    (value, fn) => fn(value),
    input
  ));
}

/**
 * @private
 */
export function composeAsync<T, U>(
  main: (input: any) => Promise<U>,
  ...etc: Stage[]
): (input: T | Promise<T>) => Promise<U> {
  return input => etc.reduceRight<Promise<any>>(
    (value, fn) => Promise.resolve(value).then(fn),
    Promise.resolve(input)
  ).then(main);
}
