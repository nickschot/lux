import createServerError from '../../../server/utils/create-server-error';
import stringify from '../../../../utils/stringify';
import type { ModelClass } from '../../interfaces';

class RecordNotFoundError extends Error {
  constructor({ name, primaryKey }: ModelClass, primaryKeyValue: unknown) {
    super(
      `Could not find ${name} with ${primaryKey} ${stringify(primaryKeyValue)}.`
    );
  }
}

export default createServerError(RecordNotFoundError, 404);
