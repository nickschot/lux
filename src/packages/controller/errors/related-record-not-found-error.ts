import createServerError from '../../server/utils/create-server-error';
import sourceFor from '../../server/utils/source-for';
import stringify from '../../../utils/stringify';
import type { ModelClass } from '../../database';
import type { ServerErrorSource } from '../../server';

/**
 * JSON:API 1.0: "A server MUST return 404 Not Found when processing a request
 * that references a related resource that does not exist."
 *
 * @internal
 */
class RelatedRecordNotFoundError extends Error {
  declare source: ServerErrorSource;

  constructor(
    { name, primaryKey }: ModelClass,
    primaryKeyValue: unknown,
    path: string
  ) {
    super(
      `Could not find ${name} with ${primaryKey} ${stringify(primaryKeyValue)}.`
    );
    this.source = sourceFor(path);
  }
}

export default createServerError(RelatedRecordNotFoundError, 404, {
  isPublic: true
});
