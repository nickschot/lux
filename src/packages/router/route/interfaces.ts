import type Controller from '../../controller';
import type { RequestMethod } from '../../server';

export type Route$type =
  'custom' | 'member' | 'collection' | 'relationship' | 'related';

export type Route$opts = {
  type: Route$type;
  path: string;
  action: string;
  method: RequestMethod;
  controller: Controller;

  // The relationship a `relationship` or `related` route serves
  // (`comments`).
  relationship?: string;

  // The controller of the related type, whose query parameters, defaults and
  // Serializer a `related` route uses.
  related?: Controller;
};
