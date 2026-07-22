import createServerError from '../../server/utils/create-server-error';

class UniqueConstraintError extends Error {}

export default createServerError(UniqueConstraintError, 409);
