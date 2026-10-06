import createSpinner from '../utils/create-spinner';
import { CWD, NODE_ENV } from '../../../constants';
import { compile } from '../../compiler';

export async function build(useStrict: boolean = false): Promise<void> {
  const spinner = createSpinner('Building your application...');

  spinner.start();

  await compile(CWD, NODE_ENV, {
    useStrict
  });

  spinner.stop();
}
