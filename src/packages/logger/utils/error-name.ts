/**
 * An error's name for the logs. Error subclasses rarely set `name`, so it is
 * the generic `Error` for nearly all of them; their class name says more.
 *
 * @internal
 */
export default function errorName(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Error';
  }

  return err.name === 'Error' ? err.constructor.name : err.name;
}
