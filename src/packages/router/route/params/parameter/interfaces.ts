import type { ParameterLikeOptions } from '../index';

export type ParameterOptions = ParameterLikeOptions & {
  values?: Array<unknown>;
};
