import { Query } from '../../../../database';
import { getDomain } from '../../../../server';
import type { Request, Response } from '../../../../server';
import { scopeFor } from '../../../../controller/visibility';
import type { Serializer$fields } from '../../../../serializer/interfaces';
import createPageLinks from '../utils/create-page-links';
import type { Action } from '../interfaces';

/**
 * @private
 */
export default function resource(action: Action<unknown>): Action<unknown> {
  const resourceAction = async function (req: Request, res: Response) {
    const {
      route: { action: actionName }
    } = req;
    const result = action(req, res);
    let links = {};
    let data;
    let total;

    if (actionName === 'index' && result instanceof Query) {
      [data, total] = await Promise.all([result, Query.from(result).count()]);
    } else {
      data = await result;
    }

    if (Array.isArray(data) || (data && data.isModelInstance)) {
      const domain = getDomain(req);

      const {
        params,
        url: { path, pathname, search },
        route: { controller }
      } = req;
      const { namespace, serializer, defaultPerPage } = controller;

      const include = params.include || [];

      if (actionName === 'index') {
        links = createPageLinks({
          params,
          domain,
          pathname,
          search: search || '',
          defaultPerPage,
          total: total || 0
        });
      } else if (actionName === 'create' && res.getHeader('Location')) {
        // The created resource, as `Location` says (JSON:API: they match).
        links = {
          self: res.getHeader('Location')
        };
      } else if (actionName !== 'index' && namespace) {
        links = {
          self: domain.replace(`/${namespace}`, '') + path
        };
      } else if (actionName !== 'index' && !namespace) {
        links = {
          self: domain + path
        };
      }

      return serializer.format({
        data,
        links,
        // How many resources match across every page: the count the page
        // links are built from, so it costs no query of its own.
        ...(actionName === 'index' && { meta: { total: total || 0 } }),
        domain,
        include,
        fields: params.fields as Serializer$fields,
        scope: scopeFor(controller.visibility, req),
        // The request's namespace, not the serializer's: a namespaced
        // controller without its own serializer is given the root one.
        namespace
      });
    }

    return data;
  };

  Reflect.defineProperty(resourceAction, 'name', {
    value: action.name
  });

  return resourceAction;
}
