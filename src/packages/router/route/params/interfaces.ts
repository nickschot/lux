import type Controller from '../../../controller';
import type { Route$type } from '../index';
import type { RequestMethod } from '../../../server';
import type { Lumen$Collection } from '../../../../interfaces';

export type Params$opts = {
  type: Route$type;
  method: RequestMethod;
  controller: Controller;
  dynamicSegments: Array<string>;
};

export type ParameterLike$opts = {
  path: string;
  type?: string;
  values?: Array<unknown>;
  min?: number;
  max?: number;
  parse?: (value: unknown) => unknown;
  items?: (path: string) => ParameterLike;
  required?: boolean;
  sanitize?: boolean;
};

export interface ParameterLike extends Lumen$Collection<unknown> {
  path: string;
  type: string;
  required: boolean;
  sanitize: boolean;

  values(): IterableIterator<unknown>;
  validate<V>(value: V): V;
}
