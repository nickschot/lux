import type Controller from '../../../controller';

import resource from './enhancers/resource';
import trackPerf from './enhancers/track-perf';
import type { Action } from './interfaces';

/**
 * The handlers of an action: `controller`'s `beforeAction` hooks, the action,
 * then its `afterAction` hooks. A related route (`/posts/1/comments`) also
 * serves the related type, so `related`'s `beforeAction` hooks run too, after
 * the owner's, each hook once (both usually inherit the same ones).
 *
 * @private
 */
export function createAction(
  type: string,
  action: Action<unknown>,
  controller: Controller,
  related?: Controller
): Array<Action<unknown>> {
  let fn = action.bind(controller);

  if (type !== 'custom' && controller.hasModel && controller.hasSerializer) {
    fn = resource(fn);
  }

  const { beforeAction } = controller;
  const handlers: Array<Action<unknown>> = [
    ...beforeAction,
    ...(type === 'related' && related
      ? related.beforeAction.filter(hook => !beforeAction.includes(hook))
      : []),

    function __FINAL_HANDLER__(req, res) {
      return fn(req, res);
    },
    ...controller.afterAction
  ];

  return handlers.map(trackPerf);
}

export { FINAL_HANDLER } from './constants';
export { default as createPageLinks } from './utils/create-page-links';

export type { Action } from './interfaces';
