import { ClientGeneratedIdError } from '../errors';

/**
 * Reject `data.id` on a create request before the parameter tree runs, so it
 * is answered with 403 (unsupported client-generated ID) rather than the 400
 * an unknown member gets.
 *
 * @internal
 */
export default function validateClientId(params: Record<string, unknown>) {
  const { data } = params;

  if (data && typeof data === 'object' && 'id' in data) {
    throw new ClientGeneratedIdError();
  }

  return true;
}
