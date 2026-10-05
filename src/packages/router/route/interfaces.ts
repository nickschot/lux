import type Controller from '../../controller';
import type { Request$method } from '../../server';

export type Route$type = 'custom' | 'member' | 'collection' | 'relationship';

export type Route$opts = {
  type: Route$type;
  path: string;
  action: string;
  method: Request$method;
  controller: Controller;

  // The relationship a `relationship` route serves (`comments`).
  relationship?: string;
};
