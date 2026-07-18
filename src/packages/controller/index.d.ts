// TEMPORARY type shim for the not-yet-converted `controller` package (Flow .js).
// Describes ONLY the surface the logger/server/router cluster consumes. Delete
// this file when `controller` is converted to TypeScript — see CLAUDE.md
// "Phase 3 status". Runtime is unaffected: Babel/esbuild ignore `.d.ts`, so the
// real `controller/index.js` is what loads.
import type { Request, Response } from '../server';
import type { ModelClass } from '../database';

export type Controller$builtIn =
  'show' | 'index' | 'create' | 'update' | 'destroy';

export type Controller$beforeAction = (
  request: Request,
  response: Response
) => Promise<unknown>;

export type Controller$afterAction = (
  request: Request,
  response: Response,
  responseData?: unknown
) => Promise<unknown>;

export const BUILT_IN_ACTIONS: ReadonlyArray<Controller$builtIn>;

/** The subset of `Serializer` the router reads off a controller. */
export interface ControllerSerializer {
  hasOne: Array<string>;
  hasMany: Array<string>;
  attributes: Array<string>;
  format(options: {
    data: unknown;
    links: unknown;
    domain: string;
    include: Array<string>;
  }): unknown;
}

export default class Controller {
  query: Array<string>;
  sort: Array<string>;
  filter: Array<string>;
  params: Array<string>;
  beforeAction: Array<Controller$beforeAction>;
  afterAction: Array<Controller$afterAction>;
  defaultPerPage: number;
  model: ModelClass;
  parent: Controller | null;
  namespace: string;
  serializer: ControllerSerializer;
  controllers: Map<string, Controller>;
  hasModel: boolean;
  hasNamespace: boolean;
  hasSerializer: boolean;
}
