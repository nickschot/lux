import chalk from '../../../utils/chalk';
import createPrompt from '../utils/create-prompt';

import generatorFor from './utils/generator-for';
import type { GeneratorOptions } from './interfaces';

/**
 * @private
 */
export async function runGenerator({
  cwd,
  type,
  name,
  attrs
}: {
  cwd: GeneratorOptions['cwd'];
  type: GeneratorOptions['type'];
  name: GeneratorOptions['name'];
  attrs: GeneratorOptions['attrs'];
}): Promise<void> {
  const generator = generatorFor(type);
  const prompt = createPrompt();

  await generator({
    cwd,
    type,
    name,
    attrs,
    onConflict: path =>
      prompt.question(
        `${chalk.green('?')} ${chalk.red('Overwrite')} ${path}? (Y/n)\r`
      )
  });

  prompt.close();
}

export type {
  Generator,
  GeneratorOptions,
  GeneratorTemplate
} from './interfaces';
