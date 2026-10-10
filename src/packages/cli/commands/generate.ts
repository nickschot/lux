import { CWD } from '../../../constants';
import { runGenerator } from '../generator';
import type { GeneratorOptions } from '../generator';

/**
 * @private
 */
export function generate({
  cwd = CWD,
  name,
  type,
  attrs = []
}: {
  cwd?: GeneratorOptions['cwd'];
  name: GeneratorOptions['name'];
  type: GeneratorOptions['type'];
  attrs?: GeneratorOptions['attrs'];
}): Promise<void> {
  return runGenerator({
    cwd,
    name,
    type,
    attrs
  });
}
