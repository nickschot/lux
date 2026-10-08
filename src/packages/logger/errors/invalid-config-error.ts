/** @internal */
class InvalidConfigError extends Error {
  constructor(key: string, value: unknown, allowed: Iterable<string>) {
    super(
      `Invalid logging.${key} ${JSON.stringify(value)}; expected one of: ` +
        `${Array.from(allowed).join(', ')}.`
    );
  }
}

export default InvalidConfigError;
