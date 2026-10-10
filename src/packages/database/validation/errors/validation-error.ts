import createServerError from '../../../server/utils/create-server-error';
import sourceFor from '../../../server/utils/source-for';
import type { ServerErrorSource } from '../../../server';

/**
 * A model validator (`static validates`) rejected an attribute. Answered with
 * 422 and a pointer to the attribute, which clients such as ember-data map to
 * field errors. The rejected value is deliberately not in the message: it
 * ends up in logs and may be a secret (e.g. a password).
 *
 * @internal
 */
class ValidationError extends Error {
  declare key: string;

  declare source: ServerErrorSource;

  constructor(key: string) {
    super(`Validation failed for ${key}.`);
    this.key = key;
    this.source = sourceFor(`data.attributes.${key}`);
  }
}

export default createServerError(ValidationError, 422, { isPublic: true });
