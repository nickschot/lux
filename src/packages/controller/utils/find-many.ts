import merge from '../../../utils/merge';
import type { Model, ModelClass, Query } from '../../database';
import type { Request } from '../../server';

import paramsToQuery from './params-to-query';

/**
 * @private
 */
export default function findMany<T extends Model>(
  model: ModelClass<T>,
  req: Request
): Query<Array<Model>> {
  const params = merge(req.defaultParams, req.params);
  const { sort, page, limit, select, filter, include } = paramsToQuery(
    model,
    params
  );

  return model
    .select(...select)
    .include(include)
    .limit(limit)
    .page(page)
    .where(filter)
    .order(...(sort as [string, string]));
}
