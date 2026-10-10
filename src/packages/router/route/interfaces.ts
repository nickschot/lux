import type Controller from '../../controller';
import type { RequestMethod } from '../../server';

export type RouteType =
  'custom' | 'member' | 'collection' | 'relationship' | 'related';

export type RouteOptions = {
  type: RouteType;
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
