import type Controller from '../../../controller';
import type { RouteType } from '../index';
import type { RequestMethod } from '../../../server';
import type { LumenCollection } from '../../../../interfaces';

export type ParamsOptions = {
  type: RouteType;
  method: RequestMethod;
  controller: Controller;
  dynamicSegments: Array<string>;
};

export type ParameterLikeOptions = {
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

export interface ParameterLike extends LumenCollection<unknown> {
  path: string;
  type: string;
  required: boolean;
  sanitize: boolean;

  values(): IterableIterator<unknown>;
  validate<V>(value: V): V;
}
