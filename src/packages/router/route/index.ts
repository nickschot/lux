import { FreezeableSet, freezeProps, deepFreezeProps } from '../../freezeable';
import { primaryKeyType } from '../../database';
import type Controller from '../../controller';
import type { Request, Response, Request$method } from '../../server';

import { FINAL_HANDLER, createAction } from './action';
import {
  paramsFor,
  defaultParamsFor,
  validateClientId,
  validateResourceId
} from './params';
import getStaticPath from './utils/get-static-path';
import getDynamicSegments from './utils/get-dynamic-segments';
import type { Action } from './action';
import type { ParameterGroup } from './params';
import type { Route$opts } from './interfaces';

/**
 * @private
 */
class Route extends FreezeableSet<Action<unknown>> {
  declare type: string;

  declare path: string;

  declare action: string;

  declare params: ParameterGroup;

  declare method: Request$method;

  declare controller: Controller;

  declare staticPath: string;

  declare defaultParams: Record<string, unknown>;

  declare dynamicSegments: Array<string>;

  constructor({ type, path, action, method, controller }: Route$opts) {
    const dynamicSegments = getDynamicSegments(path);

    if (action && controller) {
      const handler = Reflect.get(controller, action);

      if (typeof handler === 'function') {
        const params = paramsFor({
          type,
          method,
          controller,
          dynamicSegments
        });

        const staticPath = getStaticPath(path);

        const defaultParams = defaultParamsFor({
          type,
          controller
        });

        super(createAction(type, handler, controller));

        Object.assign(this, {
          type,
          path,
          params,
          action,
          method,
          controller,
          staticPath,
          defaultParams,
          dynamicSegments
        });

        freezeProps(this, true, 'type', 'path');

        freezeProps(
          this,
          false,
          'action',
          'params',
          'method',
          'controller',
          'staticPath'
        );

        deepFreezeProps(this, false, 'defaultParams', 'dynamicSegments');
      } else {
        const {
          constructor: { name: controllerName }
        } = controller;

        throw new TypeError(
          `Handler for ${controllerName}#${action} is not a function.`
        );
      }
    } else {
      throw new TypeError(
        'Arguments `controller` and `action` must not be undefined'
      );
    }

    this.freeze();
  }

  /**
   * The ids in the request path, keyed by their dynamic segment: a number for
   * a numeric primary key (or a model-less controller), else as written.
   */
  parseParams(params: Array<string>): Record<string, number | string> {
    const { model } = this.controller;
    const isNumeric = !model || primaryKeyType(model) === 'number';

    return params.reduce<Record<string, number | string>>(
      (result, value, idx) => {
        const key = this.dynamicSegments[idx];

        if (key) {
          return {
            ...result,
            [key]: isNumeric ? Number.parseInt(value, 10) : value
          };
        }

        return result;
      },
      {}
    );
  }

  async execHandlers(req: Request, res: Response): Promise<unknown> {
    let calledFinal = false;
    let data: unknown;

    for (const handler of this) {
      data = await handler(req, res, data);

      if (handler.name === FINAL_HANDLER) {
        calledFinal = true;
      }

      if (!calledFinal && typeof data !== 'undefined') {
        break;
      }
    }

    return data;
  }

  async visit(req: Request, res: Response): Promise<unknown> {
    const { defaultParams } = this;
    let params = {
      ...req.params,
      ...this.parseParams(req.url.params)
    };

    if (this.action === 'create' && req.method === 'POST') {
      validateClientId(params);
    }

    if (req.method !== 'OPTIONS') {
      params = this.params.validate(params);
    }

    Object.assign(req, {
      params,
      defaultParams
    });

    if (this.type === 'member' && req.method === 'PATCH') {
      validateResourceId(req);
    }

    return this.execHandlers(req, res);
  }
}

export default Route;
export { DYNAMIC_PATTERN } from './constants';

export type { Action } from './action';
export type { Route$opts, Route$type } from './interfaces';
