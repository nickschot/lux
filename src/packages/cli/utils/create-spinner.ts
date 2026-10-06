import ora, { type Ora } from 'ora';

/**
 * A `dots` spinner on stderr (ora's default stream).
 *
 * ora 9 works out how many lines to clear by dividing by
 * `stream.columns ?? 80`, so a terminal that reports **0** columns — a pty
 * whose size was never set, as some `docker exec -t`/CI setups give — clears
 * Infinity lines and hangs the CLI. ora 5 used `columns || 80`. There, fall
 * back to ora's non-interactive output (a single `- text` line), which is
 * what a non-TTY gets anyway.
 *
 * @private
 */
export default function createSpinner(text: string): Ora {
  const { isTTY, columns } = process.stderr;

  return ora({
    text,
    spinner: 'dots',
    ...(isTTY && !columns ? { isEnabled: false } : {})
  });
}
