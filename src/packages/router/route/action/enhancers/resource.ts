import { Query } from '../../../../database';
import { VERSION } from '../../../../jsonapi';
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
      route: { action: actionName, type, controller, relationship, related }
    } = req;
    // A related route serves resources of the related type: they are
    // serialized and paged by its controller.
    const target = (type === 'related' && related) || controller;
    const paged =
      actionName === 'index' ||
      (type === 'related' &&
        controller.model.relationshipFor(relationship || '')?.type ===
          'hasMany');

    if (type === 'related') {
      // The owning resource must exist and be visible (else a 404).
      await controller.showRelationship(req);
    }

    const result = action(req, res);
    let links = {};
    let data;
    let total;

    if (paged && result instanceof Query) {
      [data, total] = await Promise.all([result, Query.from(result).count()]);
    } else {
      data = await result;
    }

    const domain = getDomain(req);
    const {
      params,
      router,
      url: { path, pathname, search }
    } = req;

    // An empty to-one relationship.
    if (type === 'related' && data == null) {
      return {
        data: null,
        links: { self: domain + path },
        jsonapi: { version: VERSION }
      };
    }

    if (Array.isArray(data) || (data && data.isModelInstance)) {
      const { namespace } = controller;
      const { serializer, defaultPerPage } = target;
      const scope = scopeFor(controller.visibility, req);
      const routed = (key: string) => router.has(`GET:${key}`);

      if (type === 'relationship' && relationship && !Array.isArray(data)) {
        return serializer.formatRelationship({
          scope,
          domain,
          routed,
          namespace,
          item: data,
          name: relationship
        });
      }

      const include = params.include || [];

      if (paged) {
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
      } else {
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
        scope,
        routed,
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
