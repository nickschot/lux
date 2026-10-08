import type { Request } from '../../../../server';

/** @internal */
export default function getControllerName({
  route: {
    controller: {
      constructor: { name }
    }
  }
}: Request): string {
  return name;
}
