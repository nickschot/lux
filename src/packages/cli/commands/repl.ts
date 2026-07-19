import path from 'path';
import { start as startRepl } from 'repl';

import { CWD } from '../../../constants';
import type Application from '../../application';

export function repl(): Promise<void> {
  // FIXME: this async executor swallows rejections from the `require` below.
  // Pre-existing behaviour, left as-is so the lint migration stays
  // behaviour-neutral — worth fixing when this file is converted to TypeScript.
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async resolve => {
    const app: Application = await Reflect.apply(require, null, [
      path.join(CWD, 'dist', 'boot')
    ]);

    const instance = startRepl({
      prompt: '> '
    });

    instance.once('exit', resolve);

    Object.assign(instance.context, {
      app,
      logger: app.logger,
      routes: app.router,
      [app.constructor.name]: app,

      ...Array.from(app.models).reduce(
        (context, [, model]) => ({
          ...context,
          [model.name]: model
        }),
        {}
      ),

      ...Array.from(app.controllers).reduce(
        (context, [, controller]) => ({
          ...context,
          [controller.constructor.name]: controller
        }),
        {}
      ),

      ...Array.from(app.serializers).reduce(
        (context, [, serializer]) => ({
          ...context,
          [serializer.constructor.name]: serializer
        }),
        {}
      )
    });
  });
}
