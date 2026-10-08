import type Controller from '../../../controller';

import ParameterGroup from './parameter-group';
import getURLParams from './utils/get-url-params';
import getDataParams, { getDocumentParams } from './utils/get-data-params';
import getDefaultMemberParams from './utils/get-default-member-params';
import getDefaultCollectionParams from './utils/get-default-collection-params';
import type { Params$opts } from './interfaces';
import {
  getMemberQueryParams,
  getCollectionQueryParams,
  getCustomParams
} from './utils/get-query-params';

/** @internal */
export function paramsFor({
  type,
  method,
  controller,
  dynamicSegments
}: Params$opts) {
  let params = getURLParams(dynamicSegments);

  if (type === 'member') {
    params = [...params, ...getMemberQueryParams(controller)];

    if (method === 'POST' || method === 'PATCH') {
      params = [
        ...params,
        getDataParams(controller, method, true),
        ...getDocumentParams()
      ];
    }
  } else if (type === 'collection') {
    params = [...params, ...getCollectionQueryParams(controller)];

    if (method === 'POST' || method === 'PATCH') {
      params = [
        ...params,
        getDataParams(controller, method, false),
        ...getDocumentParams()
      ];
    }
  } else if (type === 'relationship') {
    // The id alone: a relationship endpoint takes no query parameters.
  } else if (type === 'custom') {
    params = [...params, ...getCustomParams(controller)];
  }

  return new ParameterGroup(params, {
    path: '',
    required: true
  });
}

/** @internal */
export function defaultParamsFor({
  type,
  controller
}: {
  type: string;
  controller: Controller;
}): Record<string, unknown> {
  const { hasModel } = controller;

  if (hasModel && type === 'member') {
    return getDefaultMemberParams(controller);
  } else if (hasModel && type === 'collection') {
    return getDefaultCollectionParams(controller);
  }

  return {};
}

export { default as validateClientId } from './utils/validate-client-id';
export { default as validateResourceId } from './utils/validate-resource-id';

export type { ParameterLike, ParameterLike$opts } from './interfaces';
export type { default as Parameter } from './parameter';
export type { default as ParameterGroup } from './parameter-group';
