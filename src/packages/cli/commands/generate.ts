import { CWD } from '../../../constants';
import { runGenerator } from '../generator';
import type { Generator$opts } from '../generator';

/**
 * @private
 */
export function generate({
  cwd = CWD,
  name,
  type,
  attrs = []
}: {
  cwd?: Generator$opts['cwd'];
  name: Generator$opts['name'];
  type: Generator$opts['type'];
  attrs?: Generator$opts['attrs'];
}): Promise<void> {
  return runGenerator({
    cwd,
    name,
    type,
    attrs
  });
}
