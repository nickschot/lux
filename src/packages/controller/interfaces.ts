import type { Model, ModelClass, Query } from '../database';
import type { Request, Response } from '../server';
import type Serializer from '../serializer';

/**
 * What Lumen constructs a controller with when the app boots. Apps don't
 * construct controllers themselves.
 */
export type ControllerOptions = {
  /** The model of the controller's resource, if it has one. */
  model?: ModelClass<Model>;

  /** The controller's namespace (`admin`), or `''` for the root. */
  namespace?: string;

  /** The serializer of the controller's resource, if it has one. */
  serializer?: Serializer<Model>;
};

export type BuiltInAction = 'show' | 'index' | 'create' | 'update' | 'destroy';

/**
 * A {@link Controller.beforeAction} hook. Resolving with anything but
 * `undefined` ends the request, with that value as the response.
 */
export type BeforeAction = (
  request: Request,
  response: Response
) => Promise<unknown>;

/**
 * A {@link Controller.afterAction} hook. `responseData` is the action's result
 * (or the previous hook's); what the hook resolves with is sent instead.
 */
export type AfterAction = (
  request: Request,
  response: Response,
  responseData?: unknown
) => Promise<unknown>;

export type FindOne<T extends Model> = (request: Request) => Query<T>;

export type FindMany<T extends Model> = (request: Request) => Query<Array<T>>;
