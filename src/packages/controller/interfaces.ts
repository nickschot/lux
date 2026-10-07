import type { Model, ModelClass, Query } from '../database';
import type { Request, Response } from '../server';
import type Serializer from '../serializer';

export type ControllerOptions = {
  model?: ModelClass<Model>;
  namespace?: string;
  serializer?: Serializer<Model>;
};

export type Controller$builtIn =
  'show' | 'index' | 'create' | 'update' | 'destroy';

export type BeforeAction = (
  request: Request,
  response: Response
) => Promise<unknown>;

export type AfterAction = (
  request: Request,
  response: Response,
  responseData?: unknown
) => Promise<unknown>;

export type Controller$findOne<T extends Model> = (
  request: Request
) => Query<T>;

export type Controller$findMany<T extends Model> = (
  request: Request
) => Query<Array<T>>;
