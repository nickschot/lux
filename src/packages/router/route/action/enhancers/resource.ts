import { Query } from '../../../../database';
import { VERSION } from '../../../../jsonapi';
import { getDomain } from '../../../../server';
import type { Request, Response } from '../../../../server';
import { scopeFor } from '../../../../controller/visibility';
import type { SerializerFields } from '../../../../serializer/interfaces';
import createPageLinks, { createSelfLink } from '../utils/create-page-links';
import type { Action } from '../interfaces';

/** @internal */
export default function resource(action: Action<unknown>): Action<unknown> {
  const resourceAction = async function (req: Request, res: Response) {
    const {
      route: { action: actionName, type, controller, relationship, related }
    } = req;
    // A related route serves resources of the related type: they are
    // serialized and paged by its controller.
    const target = (type === 'related' && related) || controller;
    const pagedRoute =
      actionName === 'index' ||
      (type === 'related' &&
        controller.model.relationshipFor(relationship || '')?.type ===
          'hasMany');

    if (type === 'related') {
      // The owning resource must exist and be visible (else a 404).
      await controller.showRelationship(req);
    }

    const result = action(req, res);
    // A custom collection action is paged when its query is: one built on
    // `index` carries the request's page. (A plain route is not: it takes no
    // `page`, so page links would point at a 400.)
    const paged =
      pagedRoute ||
      (type === 'collection' &&
        result instanceof Query &&
        result.snapshots.some(([name]) => name === 'offset'));
    let links;
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
      url: { pathname, search }
    } = req;
    // The request itself, its query percent-encoded so it is a valid URI.
    const self = createSelfLink({ domain, pathname, search: search || '' });

    // An empty to-one relationship.
    if (type === 'related' && data == null) {
      return {
        data: null,
        links: { self },
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
      // Read once so TypeScript can narrow it (`getHeader` is `string | void`).
      const location =
        actionName === 'create' ? res.getHeader('Location') : undefined;

      if (paged) {
        links = createPageLinks({
          params,
          domain,
          pathname,
          search: search || '',
          defaultPerPage,
          total: total || 0
        });
      } else if (location) {
        // The created resource, as `Location` says (JSON:API: they match).
        links = {
          self: location
        };
      } else {
        links = {
          self
        };
      }

      return serializer.format({
        data,
        links,
        // How many resources match across every page: the count the page
        // links are built from, so it costs no query of its own.
        ...(paged && { meta: { total: total || 0 } }),
        domain,
        include,
        fields: params.fields as SerializerFields,
        scope,
        routed,
        // The request's namespace, not the serializer's: a namespaced
        // controller without its own serializer is given the root one.
        namespace
      });
    }

    return data;
  };

  Object.defineProperty(resourceAction, 'name', {
    value: action.name
  });

  return resourceAction;
}
