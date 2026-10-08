import type { Request } from '../../../../server';

/** @internal */
export default function getActionName({ route: { action } }: Request): string {
  return action;
}
