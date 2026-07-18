import { FINAL_HANDLER } from '../constants';
import getActionName from '../utils/get-action-name';
import getControllerName from '../utils/get-controller-name';
import type { Request, Response } from '../../../../server';
import type { Action } from '../interfaces';

/**
 * @private
 */
export default function trackPerf<T, U extends Action<T>>(
  action: U
): Action<T> {
  const trackedAction = async function (
    req: Request,
    res: Response,
    data?: unknown
  ) {
    const start = Date.now();
    const result = await action(req, res, data);
    let { name } = action;
    let type = 'middleware';

    if (name === FINAL_HANDLER) {
      type = 'action';
      name = getActionName(req);
    } else if (!name) {
      name = 'anonymous';
    }

    res.stats.push({
      type,
      name,
      duration: Date.now() - start,
      controller: getControllerName(req)
    });

    return result;
  };

  Reflect.defineProperty(trackedAction, 'name', {
    value: action.name
  });

  return trackedAction;
}
